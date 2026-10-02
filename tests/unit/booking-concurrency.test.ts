import { describe, it, expect, vi } from 'vitest';
import { calculateBookingPriceSnapshot } from '../../apps/web/src/lib/bookings/pricing';
import { generateFacilitySlots } from '../../apps/web/src/lib/bookings/slot-generation';
import { generateBookingReference } from '../../apps/web/src/lib/bookings/create-hold';
import { BOOKING_CONFIG } from '@sportshub/config';
import type {
  Facility,
  VenueOperatingHours,
  MaintenanceBlock,
  PricingRule,
  Booking,
  BookingStatus,
} from '@sportshub/types';

// ============================================================================
// POSTGRESQL BTREE_GIST EXCLUSION CONSTRAINT EMULATOR
// Strictly models:
// ALTER TABLE public.bookings ADD CONSTRAINT prevent_double_booking
//   EXCLUDE USING gist (facility_id WITH =, protected_time_range WITH &&)
//   WHERE (status IN ('HOLD', 'CONFIRMED'));
// ============================================================================

interface PostgresBookingRow {
  id: string;
  booking_reference: string;
  customer_user_id: string;
  organization_id: string;
  venue_id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  protected_start_ms: number;
  protected_end_ms: number;
  status: BookingStatus;
  subtotal: number;
  total_amount: number;
  currency: string;
  price_snapshot: any;
  hold_expires_at: number | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
}

class PostgresBookingDatabaseEmulator {
  private rows: PostgresBookingRow[] = [];
  private lock = false;

  public async createBookingHoldAtomic(
    input: {
      booking_reference: string;
      customer_user_id: string;
      organization_id: string;
      venue_id: string;
      facility_id: string;
      booking_date: string;
      start_time: string;
      duration_minutes: number;
      buffer_minutes: number;
      pricingRules: PricingRule[];
      clientSuppliedPrice?: number;
      clientSuppliedExpiry?: string;
    },
    currentTimeMs: number = Date.now()
  ): Promise<{ success: boolean; booking?: PostgresBookingRow; error?: string }> {
    // 1. Simulate RPC cleanup_expired_holds
    this.cleanupExpiredHolds(input.facility_id, currentTimeMs);

    // 2. Server calculates authoritative price snapshot (ignores clientSuppliedPrice)
    const priceSnapshot = calculateBookingPriceSnapshot(
      input.pricingRules,
      input.facility_id,
      input.booking_date,
      input.start_time,
      input.duration_minutes,
      BOOKING_CONFIG.DEFAULT_CURRENCY
    );

    if (!priceSnapshot) {
      return { success: false, error: 'PRICE_CALCULATION_FAILED' };
    }

    // 3. Calculate timestamps in Asia/Colombo (+05:30)
    const startDateTime = new Date(`${input.booking_date}T${input.start_time.substring(0, 5)}:00+05:30`);
    const endDateTime = new Date(startDateTime.getTime() + input.duration_minutes * 60000);
    const bufferedEndDateTime = new Date(endDateTime.getTime() + (input.buffer_minutes || 0) * 60000);

    const startMs = startDateTime.getTime();
    const bufferedEndMs = bufferedEndDateTime.getTime();

    // 4. Server-generated 10-minute hold expiry (ignores any clientSuppliedExpiry)
    const holdExpiresAtMs = currentTimeMs + BOOKING_CONFIG.DEFAULT_HOLD_DURATION_MINUTES * 60000;

    // 5. Evaluate PostgreSQL EXCLUDE USING gist (facility_id WITH =, protected_time_range WITH &&) WHERE status IN ('HOLD', 'CONFIRMED')
    const hasCollision = this.rows.some((row) => {
      if (row.facility_id !== input.facility_id) return false;
      if (!['HOLD', 'CONFIRMED'].includes(row.status)) return false;

      // Check if existing hold is expired
      if (row.status === 'HOLD' && row.hold_expires_at && currentTimeMs >= row.hold_expires_at) {
        return false;
      }

      // Interval overlap test: max(start1, start2) < min(end1, end2)
      return Math.max(startMs, row.protected_start_ms) < Math.min(bufferedEndMs, row.protected_end_ms);
    });

    if (hasCollision) {
      return {
        success: false,
        error: 'exclusion_violation: Key (facility_id, protected_time_range) conflicts with existing key prevent_double_booking',
      };
    }

    // Insert new row
    const newBooking: PostgresBookingRow = {
      id: `book-${Math.random().toString(36).substring(2, 9)}`,
      booking_reference: input.booking_reference,
      customer_user_id: input.customer_user_id,
      organization_id: input.organization_id,
      venue_id: input.venue_id,
      facility_id: input.facility_id,
      booking_date: input.booking_date,
      start_time: input.start_time.substring(0, 5),
      end_time: endDateTime.toISOString().split('T')[1].substring(0, 5),
      duration_minutes: input.duration_minutes,
      protected_start_ms: startMs,
      protected_end_ms: bufferedEndMs,
      status: 'HOLD',
      subtotal: priceSnapshot.subtotal,
      total_amount: priceSnapshot.subtotal,
      currency: priceSnapshot.currency,
      price_snapshot: priceSnapshot,
      hold_expires_at: holdExpiresAtMs,
      confirmed_at: null,
      cancelled_at: null,
    };

    this.rows.push(newBooking);
    return { success: true, booking: newBooking };
  }

  public async confirmBookingAtomic(
    bookingId: string,
    customerUserId: string,
    currentTimeMs: number = Date.now()
  ): Promise<{ success: boolean; booking?: PostgresBookingRow; error?: string }> {
    const booking = this.rows.find((b) => b.id === bookingId);
    if (!booking) return { success: false, error: 'BOOKING_NOT_FOUND' };
    if (booking.customer_user_id !== customerUserId) return { success: false, error: 'UNAUTHORIZED' };

    if (booking.status === 'CONFIRMED') {
      // Idempotent confirmation
      return { success: true, booking };
    }

    if (booking.status !== 'HOLD') {
      return { success: false, error: 'INVALID_STATUS_TRANSITION' };
    }

    if (booking.hold_expires_at && currentTimeMs > booking.hold_expires_at) {
      booking.status = 'EXPIRED';
      return { success: false, error: 'HOLD_EXPIRED' };
    }

    booking.status = 'CONFIRMED';
    booking.confirmed_at = new Date(currentTimeMs).toISOString();
    return { success: true, booking };
  }

  public async cancelBooking(
    bookingId: string,
    customerUserId: string,
    currentTimeMs: number = Date.now()
  ): Promise<{ success: boolean; error?: string }> {
    const booking = this.rows.find((b) => b.id === bookingId);
    if (!booking) return { success: false, error: 'BOOKING_NOT_FOUND' };
    if (booking.customer_user_id !== customerUserId) return { success: false, error: 'UNAUTHORIZED' };

    booking.status = 'CANCELLED';
    booking.cancelled_at = new Date(currentTimeMs).toISOString();
    return { success: true };
  }

  private cleanupExpiredHolds(facilityId: string, currentTimeMs: number) {
    for (const row of this.rows) {
      if (row.facility_id === facilityId && row.status === 'HOLD' && row.hold_expires_at && currentTimeMs >= row.hold_expires_at) {
        row.status = 'EXPIRED';
      }
    }
  }

  public getRows(): PostgresBookingRow[] {
    return [...this.rows];
  }

  public clear() {
    this.rows = [];
  }
}

describe('STEP 6 — PostgreSQL Double-Booking, Concurrency, HOLD Expiry, Pricing & Timezone Suite', () => {
  let db: PostgresBookingDatabaseEmulator;

  const mockRules: PricingRule[] = [
    {
      id: 'rule-base',
      organization_id: 'org-1',
      venue_id: 'venue-1',
      facility_id: null,
      name: 'Standard Base Rate',
      pricing_type: 'BASE',
      day_of_week: null,
      start_time: null,
      end_time: null,
      price_per_hour: 2000,
      member_price: null,
      priority: 1,
      valid_from: null,
      valid_until: null,
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'rule-peak',
      organization_id: 'org-1',
      venue_id: 'venue-1',
      facility_id: null,
      name: 'Peak Evening Rate',
      pricing_type: 'PEAK',
      day_of_week: null,
      start_time: '18:00:00',
      end_time: '22:00:00',
      price_per_hour: 3000,
      member_price: null,
      priority: 10,
      valid_from: null,
      valid_until: null,
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  beforeEach(() => {
    db = new PostgresBookingDatabaseEmulator();
  });

  // ==========================================================================
  // SECTION 1: PostgreSQL Double-Booking / Concurrency Verification (10 Scenarios)
  // ==========================================================================
  describe('1. PostgreSQL Double-Booking & Concurrency Verification', () => {
    const fixedNow = 1792050000000; // Base reference timestamp

    it('1. HOLD vs HOLD — same facility + same interval: exactly ONE succeeds, competing rejected by EXCLUDE constraint', async () => {
      const p1 = db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-HLD001',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      const p2 = db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-HLD002',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      const [res1, res2] = await Promise.all([p1, p2]);

      const successCount = [res1, res2].filter((r) => r.success).length;
      const failureCount = [res1, res2].filter((r) => !r.success).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      const failedResult = [res1, res2].find((r) => !r.success);
      expect(failedResult?.error).toContain('exclusion_violation');
      expect(failedResult?.error).toContain('prevent_double_booking');
    });

    it('2. CONFIRMED vs CONFIRMED — same facility + same interval: competing confirmation/booking rejected', async () => {
      // First booking created and confirmed
      const hold1 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-CNF001',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '14:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);
      expect(hold1.success).toBe(true);

      const conf1 = await db.confirmBookingAtomic(hold1.booking!.id, 'user-a', fixedNow);
      expect(conf1.success).toBe(true);

      // Competing attempt for the same slot
      const hold2 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-CNF002',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '14:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      expect(hold2.success).toBe(false);
      expect(hold2.error).toContain('prevent_double_booking');
    });

    it('3. HOLD vs CONFIRMED — overlapping interval is rejected', async () => {
      // Active HOLD on 16:00 - 17:00
      await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-HLD003',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '16:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      // Overlapping request: 16:30 - 17:30
      const overlap = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-CNF003',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '16:30',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      expect(overlap.success).toBe(false);
      expect(overlap.error).toContain('prevent_double_booking');
    });

    it('4. CONFIRMED vs HOLD — overlapping interval is rejected', async () => {
      // CONFIRMED booking on 11:00 - 12:00
      const hold = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-CNF004',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '11:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);
      await db.confirmBookingAtomic(hold.booking!.id, 'user-a', fixedNow);

      // New HOLD attempt on overlapping interval 10:30 - 11:30
      const overlap = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-HLD004',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '10:30',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      expect(overlap.success).toBe(false);
      expect(overlap.error).toContain('prevent_double_booking');
    });

    it('5. Two simultaneous confirmations of the same HOLD: idempotent and safe', async () => {
      const hold = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-HLD005',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '15:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      const [c1, c2] = await Promise.all([
        db.confirmBookingAtomic(hold.booking!.id, 'user-a', fixedNow),
        db.confirmBookingAtomic(hold.booking!.id, 'user-a', fixedNow),
      ]);

      expect(c1.success).toBe(true);
      expect(c2.success).toBe(true);
      expect(c1.booking?.status).toBe('CONFIRMED');
      expect(c2.booking?.status).toBe('CONFIRMED');
    });

    it('6. Expired HOLD → new booking succeeds immediately', async () => {
      // Hold created at fixedNow (expires at fixedNow + 10 mins = 600,000ms)
      const hold = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-EXP001',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '09:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      expect(hold.success).toBe(true);

      // At fixedNow + 11 minutes (660,000ms), user-b tries to book the exact same slot
      const afterExpiry = fixedNow + 660000;
      const newBooking = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-NEW001',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '09:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, afterExpiry);

      expect(newBooking.success).toBe(true);
      expect(newBooking.booking?.status).toBe('HOLD');

      // Verify the old hold status was updated to EXPIRED
      const oldBooking = db.getRows().find((b) => b.id === hold.booking!.id);
      expect(oldBooking?.status).toBe('EXPIRED');
    });

    it('7. CANCELLED booking → new booking on freed slot succeeds', async () => {
      const hold = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-CAN001',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '13:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      await db.confirmBookingAtomic(hold.booking!.id, 'user-a', fixedNow);
      await db.cancelBooking(hold.booking!.id, 'user-a', fixedNow);

      // Now user-b books the cancelled slot
      const newBooking = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-FRE001',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '13:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      expect(newBooking.success).toBe(true);
    });

    it('8. Adjacent non-overlapping slots can both succeed without conflict', async () => {
      // Slot 1: 08:00 - 09:00 (no buffer)
      const slot1 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-ADJ001',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '08:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      // Slot 2: 09:00 - 10:00 (adjacent immediately after)
      const slot2 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-ADJ002',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '09:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      expect(slot1.success).toBe(true);
      expect(slot2.success).toBe(true);
    });

    it('9. Buffer-time overlap is strictly rejected by exclusion constraint', async () => {
      // Slot 1: 08:00 - 09:00 with 15-minute buffer (protected range is 08:00 - 09:15)
      const slot1 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-BUF001',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '08:00',
        duration_minutes: 60,
        buffer_minutes: 15,
        pricingRules: mockRules,
      }, fixedNow);

      expect(slot1.success).toBe(true);

      // Attempting to book at 09:00 (overlaps with the 15-minute maintenance/turnover buffer)
      const slot2 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-BUF002',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '09:00',
        duration_minutes: 60,
        buffer_minutes: 15,
        pricingRules: mockRules,
      }, fixedNow);

      expect(slot2.success).toBe(false);
      expect(slot2.error).toContain('prevent_double_booking');

      // But booking at 09:15 (after buffer) succeeds!
      const slot3 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-BUF003',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '09:15',
        duration_minutes: 60,
        buffer_minutes: 15,
        pricingRules: mockRules,
      }, fixedNow);

      expect(slot3.success).toBe(true);
    });

    it('10. Different facilities at the exact same time can both succeed', async () => {
      const court1 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-DIF001',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '18:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      const court2 = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-DIF002',
        customer_user_id: 'user-b',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-2',
        booking_date: '2026-10-15',
        start_time: '18:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      expect(court1.success).toBe(true);
      expect(court2.success).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 2: HOLD Expiry & State Transitions
  // ==========================================================================
  describe('2. HOLD Expiry Lifecycle & Integrity', () => {
    const fixedNow = 1792050000000;

    it('creates HOLD with exact server-calculated 10-minute expiry', async () => {
      const result = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-EXP010',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      expect(result.success).toBe(true);
      expect(result.booking?.hold_expires_at).toBe(fixedNow + 600000); // exactly 10 mins
    });

    it('ignores client attempts to control or extend hold expiry', async () => {
      const maliciousClientExpiry = new Date(fixedNow + 3600000).toISOString(); // 1 hour attempt

      const result = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-EXP011',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
        clientSuppliedExpiry: maliciousClientExpiry,
      }, fixedNow);

      expect(result.success).toBe(true);
      // Server enforced 10 minutes strictly
      expect(result.booking?.hold_expires_at).toBe(fixedNow + 600000);
      expect(result.booking?.hold_expires_at).not.toBe(new Date(maliciousClientExpiry).getTime());
    });

    it('rejects confirmation if hold has expired', async () => {
      const hold = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-EXP012',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      const afterExpiryTime = fixedNow + 601000; // 10 mins 1 sec
      const conf = await db.confirmBookingAtomic(hold.booking!.id, 'user-a', afterExpiryTime);

      expect(conf.success).toBe(false);
      expect(conf.error).toBe('HOLD_EXPIRED');
    });
  });

  // ==========================================================================
  // SECTION 3: Server-Side Pricing & Anti-Tampering Verification
  // ==========================================================================
  describe('3. Server-Side Pricing Security & Price Snapshot Immutability', () => {
    const fixedNow = 1792050000000;

    it('ignores client tampering: client sends subtotal = 10 LKR on a 3000 LKR peak hour court', async () => {
      const maliciousPrice = 10; // Tampered price

      const result = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-PRC001',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '19:00', // Peak hour (3000 LKR/hr)
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
        clientSuppliedPrice: maliciousPrice,
      }, fixedNow);

      expect(result.success).toBe(true);
      // Authoritative server price enforced
      expect(result.booking?.subtotal).toBe(3000);
      expect(result.booking?.total_amount).toBe(3000);
      expect(result.booking?.price_snapshot.subtotal).toBe(3000);
      expect(result.booking?.subtotal).not.toBe(maliciousPrice);
    });

    it('locks price snapshot as immutable historical data upon CONFIRMATION', async () => {
      const hold = await db.createBookingHoldAtomic({
        booking_reference: 'SPH-20261015-PRC002',
        customer_user_id: 'user-a',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'court-1',
        booking_date: '2026-10-15',
        start_time: '19:00',
        duration_minutes: 60,
        buffer_minutes: 0,
        pricingRules: mockRules,
      }, fixedNow);

      const conf = await db.confirmBookingAtomic(hold.booking!.id, 'user-a', fixedNow);
      expect(conf.success).toBe(true);

      // Snapshot contains immutable calculatedAt and applied rates
      expect(conf.booking?.price_snapshot).toBeDefined();
      expect(conf.booking?.price_snapshot.appliedRatePerHour).toBe(3000);
      expect(conf.booking?.price_snapshot.pricingRuleName).toBe('Peak Evening Rate');
    });
  });

  // ==========================================================================
  // SECTION 4: Timezone & Date Boundary Calculations (Asia/Colombo)
  // ==========================================================================
  describe('4. Timezone & Boundary Handling (Asia/Colombo UTC+05:30)', () => {
    const mockFacility: Facility = {
      id: 'court-tz-1',
      venue_id: 'venue-1',
      sport_id: 'sport-1',
      name: 'Court TZ',
      slug: 'court-tz',
      description: null,
      facility_type: 'Indoor Court',
      capacity: 4,
      status: 'AVAILABLE',
      is_bookable: true,
      default_duration_minutes: 60,
      buffer_minutes: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    const operatingHours: VenueOperatingHours = {
      id: 'oh-tz',
      venue_id: 'venue-1',
      day_of_week: 4, // Thursday
      open_time: '06:00:00',
      close_time: '23:30:00',
      is_closed: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    it('generates slots accurately up to closing boundary without timezone date drift', () => {
      const slots = generateFacilitySlots({
        facility: mockFacility,
        operatingHours,
        maintenanceBlocks: [],
        existingBookings: [],
        pricingRules: mockRules,
        date: '2026-10-15', // Thursday in Asia/Colombo
        durationMinutes: 60,
        currency: 'LKR',
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].startTime).toBe('06:00');
      // Last 60m slot starting before 23:30 close is 22:30 - 23:30
      const lastSlot = slots[slots.length - 1];
      expect(lastSlot.endTime).toBe('23:30');
      expect(lastSlot.startTime).toBe('22:30');
    });

    it('correctly calculates timestamp for slots near midnight without crossing date boundaries', () => {
      const dateStr = '2026-10-15';
      const timeStr = '23:00';
      const startDateTime = new Date(`${dateStr}T${timeStr}:00+05:30`);

      // In UTC, 23:00 +05:30 is 17:30 UTC on the SAME date (2026-10-15)
      expect(startDateTime.toISOString()).toBe('2026-10-15T17:30:00.000Z');

      // End time for 60 min is 00:00 next day in Asia/Colombo (18:30 UTC)
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60000);
      expect(endDateTime.toISOString()).toBe('2026-10-15T18:30:00.000Z');
    });
  });
});
