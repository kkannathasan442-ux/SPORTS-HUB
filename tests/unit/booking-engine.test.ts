import { describe, it, expect } from 'vitest';
import {
  createBookingHoldSchema,
  confirmBookingSchema,
  cancelBookingSchema,
  facilitySlotQuerySchema,
  walkInBookingSchema,
} from '@sportshub/validation';
import { generateBookingReference } from '../../apps/web/src/lib/bookings/create-hold';
import { calculateBookingPriceSnapshot } from '../../apps/web/src/lib/bookings/pricing';
import { generateFacilitySlots } from '../../apps/web/src/lib/bookings/slot-generation';
import type {
  Facility,
  VenueOperatingHours,
  MaintenanceBlock,
  PricingRule,
  Booking,
} from '@sportshub/types';

describe('STEP 6 — Booking Engine, Slots, Pricing & Hold Management Unit Tests', () => {
  // ==========================================================================
  // 1. Zod Validation Schemas
  // ==========================================================================
  describe('Zod Validation Schemas', () => {
    it('validates correct booking hold request payload', () => {
      const validHold = {
        facilityId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2026-10-15',
        startTime: '18:00',
        durationMinutes: 60,
        customerNote: 'Need tournament shuttlecocks',
      };

      const result = createBookingHoldSchema.safeParse(validHold);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.durationMinutes).toBe(60);
      }
    });

    it('rejects booking hold duration less than 30 minutes', () => {
      const invalid = {
        facilityId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2026-10-15',
        startTime: '18:00',
        durationMinutes: 15,
      };

      const result = createBookingHoldSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid date and time formats for holds', () => {
      expect(
        createBookingHoldSchema.safeParse({
          facilityId: '550e8400-e29b-41d4-a716-446655440000',
          date: '15-10-2026',
          startTime: '18:00',
        }).success
      ).toBe(false);

      expect(
        createBookingHoldSchema.safeParse({
          facilityId: '550e8400-e29b-41d4-a716-446655440000',
          date: '2026-10-15',
          startTime: '25:00',
        }).success
      ).toBe(false);
    });

    it('validates confirm and cancel booking schemas', () => {
      const validConfirm = { bookingId: '550e8400-e29b-41d4-a716-446655440000' };
      expect(confirmBookingSchema.safeParse(validConfirm).success).toBe(true);

      const validCancel = {
        bookingId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Player injured during practice',
      };
      expect(cancelBookingSchema.safeParse(validCancel).success).toBe(true);
    });

    it('validates walk-in booking payload with payment details', () => {
      const validWalkIn = {
        venueId: '550e8400-e29b-41d4-a716-446655440000',
        facilityId: '660e8400-e29b-41d4-a716-446655440000',
        bookingDate: '2026-10-15',
        startTime: '14:00',
        durationMinutes: 90,
        customerName: 'Kanesh K',
        customerPhone: '+94771234567',
        customerEmail: 'kanesh@example.com',
        paymentMethod: 'CASH',
        amountPaid: 3500,
        notes: 'Walk-in cash received at reception',
      };

      const result = walkInBookingSchema.safeParse(validWalkIn);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Booking Reference Generator
  // ==========================================================================
  describe('Booking Reference Generator', () => {
    it('generates references matching SPH-YYYYMMDD-XXXXXX format', () => {
      const ref = generateBookingReference('2026-10-15');
      expect(ref).toMatch(/^SPH-20261015-[A-Z0-9]{6}$/);
    });

    it('generates distinct references for consecutive calls', () => {
      const ref1 = generateBookingReference('2026-10-15');
      const ref2 = generateBookingReference('2026-10-15');
      expect(ref1).not.toBe(ref2);
    });
  });

  // ==========================================================================
  // 3. Dynamic Zero-Fake Pricing Engine
  // ==========================================================================
  describe('Dynamic Pricing Calculation Engine', () => {
    const mockPricingRules: PricingRule[] = [
      {
        id: 'rule-base',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: null,
        name: 'Standard Venue Base Rate',
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
        id: 'rule-peak-evening',
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
      {
        id: 'rule-fac-special',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'fac-premium-1',
        name: 'Court 1 Premium Rate',
        pricing_type: 'CUSTOM',
        day_of_week: null,
        start_time: null,
        end_time: null,
        price_per_hour: 3500,
        member_price: null,
        priority: 20,
        valid_from: null,
        valid_until: null,
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    it('calculates standard base rate for 60 minutes during daytime', () => {
      const snapshot = calculateBookingPriceSnapshot(
        mockPricingRules,
        'fac-regular-1',
        '2026-10-15',
        '10:00',
        60,
        'LKR'
      );

      expect(snapshot).not.toBeNull();
      expect(snapshot?.baseRatePerHour).toBe(2000);
      expect(snapshot?.subtotal).toBe(2000);
      expect(snapshot?.pricingRuleName).toBe('Standard Venue Base Rate');
      expect(snapshot?.currency).toBe('LKR');
    });

    it('calculates prorated rate for 90 minutes (1.5x hourly rate)', () => {
      const snapshot = calculateBookingPriceSnapshot(
        mockPricingRules,
        'fac-regular-1',
        '2026-10-15',
        '10:00',
        90,
        'LKR'
      );

      expect(snapshot).not.toBeNull();
      expect(snapshot?.subtotal).toBe(3000); // 2000 * 1.5
    });

    it('applies peak evening rate when time slot falls between 18:00 and 22:00', () => {
      const snapshot = calculateBookingPriceSnapshot(
        mockPricingRules,
        'fac-regular-1',
        '2026-10-15',
        '19:00',
        60,
        'LKR'
      );

      expect(snapshot).not.toBeNull();
      expect(snapshot?.appliedRatePerHour).toBe(3000);
      expect(snapshot?.subtotal).toBe(3000);
      expect(snapshot?.pricingRuleName).toBe('Peak Evening Rate');
    });

    it('favors facility-specific rule over venue-level rules due to priority', () => {
      const snapshot = calculateBookingPriceSnapshot(
        mockPricingRules,
        'fac-premium-1',
        '2026-10-15',
        '19:00',
        60,
        'LKR'
      );

      expect(snapshot).not.toBeNull();
      expect(snapshot?.appliedRatePerHour).toBe(3500);
      expect(snapshot?.subtotal).toBe(3500);
      expect(snapshot?.pricingRuleName).toBe('Court 1 Premium Rate');
    });

    it('returns null if no pricing rules match (zero fake data guarantee)', () => {
      const snapshot = calculateBookingPriceSnapshot(
        [],
        'fac-unknown',
        '2026-10-15',
        '10:00',
        60,
        'LKR'
      );

      expect(snapshot).toBeNull();
    });
  });

  // ==========================================================================
  // 4. Slot Generation & Conflict Detection
  // ==========================================================================
  describe('Slot Generation & Conflict Engine', () => {
    const mockFacility: Facility = {
      id: 'fac-1',
      venue_id: 'venue-1',
      sport_id: 'sport-badminton',
      name: 'Badminton Court 01',
      slug: 'badminton-court-01',
      description: 'Wooden sprung court',
      facility_type: 'Indoor Court',
      capacity: 4,
      status: 'AVAILABLE',
      is_bookable: true,
      default_duration_minutes: 60,
      buffer_minutes: 15,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    const mockOperatingHours: VenueOperatingHours = {
      id: 'oh-weekday',
      venue_id: 'venue-1',
      day_of_week: 4, // Thursday (2026-10-15 is Thursday)
      open_time: '08:00:00',
      close_time: '12:00:00', // 4 hours window for clean testing
      is_closed: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    const mockPricingRules: PricingRule[] = [
      {
        id: 'r-1',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: null,
        name: 'Base Rate',
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
    ];

    it('generates continuous slots respecting operating hours', () => {
      // 08:00 to 12:00 with 60m duration and 15m step (or 30m grid)
      const slots = generateFacilitySlots({
        facility: mockFacility,
        operatingHours: mockOperatingHours,
        maintenanceBlocks: [],
        existingBookings: [],
        pricingRules: mockPricingRules,
        date: '2026-10-15',
        durationMinutes: 60,
        currency: 'LKR',
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].startTime).toBe('08:00');
      expect(slots[0].endTime).toBe('09:00');
      expect(slots[0].isAvailable).toBe(true);
      expect(slots[0].price).toBe(2000);
    });

    it('marks slot as UNAVAILABLE when overlapping an active booking', () => {
      const activeBooking: Booking = {
        id: 'book-1',
        booking_reference: 'SPH-20261015-ABC123',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'fac-1',
        sport_id: 'sport-badminton',
        customer_user_id: 'cust-1',
        customer_profile_id: null,
        booking_date: '2026-10-15',
        start_time: '08:30',
        end_time: '09:30',
        duration_minutes: 60,
        protected_time_range: '[2026-10-15T08:30:00+05:30, 2026-10-15T09:45:00+05:30)',
        status: 'CONFIRMED',
        subtotal: 2000,
        discount_amount: 0,
        total_amount: 2000,
        currency: 'LKR',
        price_snapshot: {},
        hold_expires_at: null,
        customer_note: null,
        cancelled_at: null,
        cancellation_reason: null,
        confirmed_at: '2026-10-10T10:00:00Z',
        created_at: '2026-10-10T10:00:00Z',
        updated_at: '2026-10-10T10:00:00Z',
      };

      const slots = generateFacilitySlots({
        facility: mockFacility,
        operatingHours: mockOperatingHours,
        maintenanceBlocks: [],
        existingBookings: [activeBooking],
        pricingRules: mockPricingRules,
        date: '2026-10-15',
        durationMinutes: 60,
        currency: 'LKR',
      });

      // 08:00 - 09:00 with 15m buffer overlaps with 08:30 booking
      const slot0800 = slots.find((s) => s.startTime === '08:00');
      const slot0830 = slots.find((s) => s.startTime === '08:30');

      expect(slot0800?.isAvailable).toBe(false);
      expect(slot0800?.unavailableReason).toBe('BOOKED');
      expect(slot0830?.isAvailable).toBe(false);
      expect(slot0830?.unavailableReason).toBe('BOOKED');
    });

    it('marks slot as UNAVAILABLE when overlapping an active maintenance block', () => {
      const maintenance: MaintenanceBlock = {
        id: 'maint-1',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'fac-1',
        start_at: '2026-10-15T10:00:00+05:30',
        end_at: '2026-10-15T11:30:00+05:30',
        status: 'ACTIVE',
        reason: 'Net repair and court vacuuming',
        created_by: 'staff-1',
        created_at: '2026-10-01',
        updated_at: '2026-10-01',
      };

      const slots = generateFacilitySlots({
        facility: mockFacility,
        operatingHours: mockOperatingHours,
        maintenanceBlocks: [maintenance],
        existingBookings: [],
        pricingRules: mockPricingRules,
        date: '2026-10-15',
        durationMinutes: 60,
        currency: 'LKR',
      });

      const slot1000 = slots.find((s) => s.startTime === '10:00');
      const slot1030 = slots.find((s) => s.startTime === '10:30');

      expect(slot1000?.isAvailable).toBe(false);
      expect(slot1000?.unavailableReason).toBe('MAINTENANCE');
      expect(slot1030?.isAvailable).toBe(false);
      expect(slot1030?.unavailableReason).toBe('MAINTENANCE');
    });

    it('frees up slot if hold has expired', () => {
      const expiredHoldBooking: Booking = {
        id: 'hold-expired-1',
        booking_reference: 'SPH-20261015-EXP001',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'fac-1',
        sport_id: 'sport-badminton',
        customer_user_id: 'cust-2',
        customer_profile_id: null,
        booking_date: '2026-10-15',
        start_time: '08:00',
        end_time: '09:00',
        duration_minutes: 60,
        protected_time_range: '[2026-10-15T08:00:00+05:30, 2026-10-15T09:15:00+05:30)',
        status: 'HOLD',
        subtotal: 2000,
        discount_amount: 0,
        total_amount: 2000,
        currency: 'LKR',
        price_snapshot: {},
        // Expired in the past
        hold_expires_at: '2026-10-01T08:10:00Z',
        customer_note: null,
        cancelled_at: null,
        cancellation_reason: null,
        confirmed_at: null,
        created_at: '2026-10-01T08:00:00Z',
        updated_at: '2026-10-01T08:00:00Z',
      };

      const slots = generateFacilitySlots({
        facility: mockFacility,
        operatingHours: mockOperatingHours,
        maintenanceBlocks: [],
        existingBookings: [expiredHoldBooking],
        pricingRules: mockPricingRules,
        date: '2026-10-15',
        durationMinutes: 60,
        currency: 'LKR',
      });

      const slot0800 = slots.find((s) => s.startTime === '08:00');
      // Because the hold expired in the past, the slot is liberated and available!
      expect(slot0800?.isAvailable).toBe(true);
      expect(slot0800?.unavailableReason).toBeUndefined();
    });
  });
});
