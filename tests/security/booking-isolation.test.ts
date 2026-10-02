import { describe, it, expect } from 'vitest';
import type { AppRole, MemberStatus, BookingStatus } from '@sportshub/types';

// ============================================================================
// SIMULATED RLS & BOOKING ENGINE SECURITY ENGINE
// ============================================================================

interface SecurityContext {
  userId: string | null;
  memberships: Array<{
    organizationId: string;
    userId: string;
    role: AppRole;
    status: MemberStatus;
  }>;
}

interface SimulatedBooking {
  id: string;
  booking_reference: string;
  customer_user_id: string;
  organization_id: string;
  venue_id: string;
  facility_id: string;
  status: BookingStatus;
  protected_time_start: number; // timestamp in ms
  protected_time_end: number;   // timestamp in ms
  subtotal: number;
  total_amount: number;
  currency: string;
  hold_expires_at: number | null; // timestamp in ms
}

class BookingSecurityEngine {
  public static isSuperAdmin(ctx: SecurityContext): boolean {
    if (!ctx.userId) return false;
    return ctx.memberships.some(
      (m) => m.userId === ctx.userId && m.role === 'SUPER_ADMIN' && m.status === 'ACTIVE'
    );
  }

  public static isOrgStaff(ctx: SecurityContext, organizationId: string): boolean {
    if (!ctx.userId) return false;
    return ctx.memberships.some(
      (m) =>
        m.organizationId === organizationId &&
        m.userId === ctx.userId &&
        ['OWNER', 'MANAGER', 'RECEPTIONIST'].includes(m.role) &&
        m.status === 'ACTIVE'
    );
  }

  /**
   * Evaluates if context user can view/select a specific booking.
   * Allowed if:
   * 1. User is the customer who made the booking.
   * 2. User is an active staff/owner of the organization that owns the venue.
   * 3. User is platform SUPER_ADMIN.
   */
  public static canSelectBooking(ctx: SecurityContext, booking: SimulatedBooking): boolean {
    if (!ctx.userId) return false;
    if (this.isSuperAdmin(ctx)) return true;
    if (ctx.userId === booking.customer_user_id) return true;
    return this.isOrgStaff(ctx, booking.organization_id);
  }

  /**
   * Evaluates if context user can cancel a booking.
   * Customer can cancel only their own upcoming booking.
   * Staff can cancel any booking in their organization.
   */
  public static canCancelBooking(ctx: SecurityContext, booking: SimulatedBooking): boolean {
    if (!ctx.userId) return false;
    if (this.isSuperAdmin(ctx)) return true;
    if (this.isOrgStaff(ctx, booking.organization_id)) return true;

    // Customer can only cancel if it's their booking and status is HOLD or CONFIRMED
    if (ctx.userId === booking.customer_user_id) {
      return ['HOLD', 'CONFIRMED'].includes(booking.status);
    }

    return false;
  }

  /**
   * Evaluates if a hold can transition to CONFIRMED.
   * Must have status HOLD and hold_expires_at > now.
   */
  public static canConfirmHold(
    ctx: SecurityContext,
    booking: SimulatedBooking,
    currentTimeMs: number
  ): { allowed: boolean; reason?: string } {
    if (!ctx.userId) return { allowed: false, reason: 'UNAUTHORIZED' };
    if (booking.customer_user_id !== ctx.userId && !this.isOrgStaff(ctx, booking.organization_id)) {
      return { allowed: false, reason: 'FORBIDDEN' };
    }
    if (booking.status !== 'HOLD') {
      return { allowed: false, reason: 'INVALID_STATUS' };
    }
    if (booking.hold_expires_at && currentTimeMs > booking.hold_expires_at) {
      return { allowed: false, reason: 'HOLD_EXPIRED' };
    }
    return { allowed: true };
  }

  /**
   * Evaluates time-range collision with existing active bookings / holds (Postgres exclusion constraint simulation).
   */
  public static checkCollision(
    existingBookings: SimulatedBooking[],
    facilityId: string,
    startMs: number,
    endMs: number,
    currentTimeMs: number
  ): boolean {
    return existingBookings.some((b) => {
      if (b.facility_id !== facilityId) return false;

      // Ignore cancelled or completed bookings
      if (['CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED'].includes(b.status)) return false;

      // Ignore expired holds
      if (b.status === 'HOLD' && b.hold_expires_at && currentTimeMs > b.hold_expires_at) {
        return false;
      }

      // Check interval overlap: [startMs, endMs) vs [b.start, b.end)
      const overlap = Math.max(startMs, b.protected_time_start) < Math.min(endMs, b.protected_time_end);
      return overlap;
    });
  }
}

describe('STEP 6 — Booking Security, Isolation & Integrity Test Suite', () => {
  const customerA = '11111111-1111-1111-1111-111111111111';
  const customerB = '22222222-2222-2222-2222-222222222222';
  const receptionistOrgA = '33333333-3333-3333-3333-333333333333';
  const ownerOrgB = '44444444-4444-4444-4444-444444444444';
  const superAdmin = '99999999-9999-9999-9999-999999999999';

  const orgA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const orgB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const ctxCustomerA: SecurityContext = {
    userId: customerA,
    memberships: [],
  };

  const ctxCustomerB: SecurityContext = {
    userId: customerB,
    memberships: [],
  };

  const ctxReceptionistA: SecurityContext = {
    userId: receptionistOrgA,
    memberships: [
      { organizationId: orgA, userId: receptionistOrgA, role: 'RECEPTIONIST', status: 'ACTIVE' },
    ],
  };

  const ctxOwnerB: SecurityContext = {
    userId: ownerOrgB,
    memberships: [
      { organizationId: orgB, userId: ownerOrgB, role: 'OWNER', status: 'ACTIVE' },
    ],
  };

  const ctxSuperAdmin: SecurityContext = {
    userId: superAdmin,
    memberships: [
      { organizationId: '00000000-0000-0000-0000-000000000000', userId: superAdmin, role: 'SUPER_ADMIN', status: 'ACTIVE' },
    ],
  };

  const bookingOrgA: SimulatedBooking = {
    id: 'book-a-1',
    booking_reference: 'SPH-20261015-ORG001',
    customer_user_id: customerA,
    organization_id: orgA,
    venue_id: 'venue-a-1',
    facility_id: 'fac-a-1',
    status: 'CONFIRMED',
    protected_time_start: 1792058400000, // 10:00 AM
    protected_time_end: 1792062900000,   // 11:15 AM (with 15m buffer)
    subtotal: 2500,
    total_amount: 2500,
    currency: 'LKR',
    hold_expires_at: null,
  };

  const bookingOrgB: SimulatedBooking = {
    id: 'book-b-1',
    booking_reference: 'SPH-20261015-ORG002',
    customer_user_id: customerB,
    organization_id: orgB,
    venue_id: 'venue-b-1',
    facility_id: 'fac-b-1',
    status: 'CONFIRMED',
    protected_time_start: 1792058400000,
    protected_time_end: 1792062000000,
    subtotal: 3000,
    total_amount: 3000,
    currency: 'LKR',
    hold_expires_at: null,
  };

  describe('1. Customer Data Privacy & Isolation', () => {
    it('allows customer A to read their own booking', () => {
      expect(BookingSecurityEngine.canSelectBooking(ctxCustomerA, bookingOrgA)).toBe(true);
    });

    it('PREVENTS customer B from viewing customer A’s booking details', () => {
      expect(BookingSecurityEngine.canSelectBooking(ctxCustomerB, bookingOrgA)).toBe(false);
    });

    it('allows customer A to cancel their own confirmed booking', () => {
      expect(BookingSecurityEngine.canCancelBooking(ctxCustomerA, bookingOrgA)).toBe(true);
    });

    it('PREVENTS customer B from cancelling customer A’s booking', () => {
      expect(BookingSecurityEngine.canCancelBooking(ctxCustomerB, bookingOrgA)).toBe(false);
    });
  });

  describe('2. Multi-Tenant Boundary Isolation', () => {
    it('allows Receptionist of Org A to view bookings belonging to Org A', () => {
      expect(BookingSecurityEngine.canSelectBooking(ctxReceptionistA, bookingOrgA)).toBe(true);
    });

    it('PREVENTS Receptionist of Org A from viewing bookings in Org B', () => {
      expect(BookingSecurityEngine.canSelectBooking(ctxReceptionistA, bookingOrgB)).toBe(false);
    });

    it('PREVENTS Owner of Org B from cancelling bookings in Org A', () => {
      expect(BookingSecurityEngine.canCancelBooking(ctxOwnerB, bookingOrgA)).toBe(false);
    });

    it('allows Super Admin to view and manage bookings across any organization', () => {
      expect(BookingSecurityEngine.canSelectBooking(ctxSuperAdmin, bookingOrgA)).toBe(true);
      expect(BookingSecurityEngine.canSelectBooking(ctxSuperAdmin, bookingOrgB)).toBe(true);
    });
  });

  describe('3. Hold Expiry & Confirmation State Machine', () => {
    const baseTime = 1792050000000;
    const activeHold: SimulatedBooking = {
      id: 'hold-1',
      booking_reference: 'SPH-20261015-HLD001',
      customer_user_id: customerA,
      organization_id: orgA,
      venue_id: 'venue-a-1',
      facility_id: 'fac-a-1',
      status: 'HOLD',
      protected_time_start: baseTime + 3600000,
      protected_time_end: baseTime + 7200000,
      subtotal: 2000,
      total_amount: 2000,
      currency: 'LKR',
      hold_expires_at: baseTime + 600000, // 10 minutes from baseTime
    };

    it('allows confirmation before 10-minute hold expiration', () => {
      const withinWindow = baseTime + 300000; // 5 minutes in
      const result = BookingSecurityEngine.canConfirmHold(ctxCustomerA, activeHold, withinWindow);
      expect(result.allowed).toBe(true);
    });

    it('REJECTS confirmation after 10-minute hold expiration', () => {
      const expiredTime = baseTime + 700000; // 11 minutes in
      const result = BookingSecurityEngine.canConfirmHold(ctxCustomerA, activeHold, expiredTime);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('HOLD_EXPIRED');
    });

    it('REJECTS confirmation from an unrelated customer', () => {
      const withinWindow = baseTime + 300000;
      const result = BookingSecurityEngine.canConfirmHold(ctxCustomerB, activeHold, withinWindow);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('FORBIDDEN');
    });
  });

  describe('4. Double Booking & Exclusion Constraint Simulation', () => {
    const currentTime = 1792050000000;
    const start = 1792058400000; // 10:00
    const end = 1792062000000;   // 11:00

    it('detects collision when new booking overlaps an active confirmed booking', () => {
      const existing = [bookingOrgA]; // fac-a-1: 10:00 to 11:15 (with buffer)
      const hasCollision = BookingSecurityEngine.checkCollision(
        existing,
        'fac-a-1',
        start,
        end,
        currentTime
      );
      expect(hasCollision).toBe(true);
    });

    it('allows booking on a different facility without conflict', () => {
      const existing = [bookingOrgA]; // fac-a-1
      const hasCollision = BookingSecurityEngine.checkCollision(
        existing,
        'fac-a-2', // Different court
        start,
        end,
        currentTime
      );
      expect(hasCollision).toBe(false);
    });

    it('allows booking when existing hold on same slot is already expired', () => {
      const expiredHold: SimulatedBooking = {
        id: 'hold-exp',
        booking_reference: 'SPH-20261015-EXP999',
        customer_user_id: customerB,
        organization_id: orgA,
        venue_id: 'venue-a-1',
        facility_id: 'fac-a-1',
        status: 'HOLD',
        protected_time_start: start,
        protected_time_end: end,
        subtotal: 2000,
        total_amount: 2000,
        currency: 'LKR',
        hold_expires_at: currentTime - 60000, // Expired 1 min ago
      };

      const hasCollision = BookingSecurityEngine.checkCollision(
        [expiredHold],
        'fac-a-1',
        start,
        end,
        currentTime
      );
      expect(hasCollision).toBe(false);
    });
  });
});
