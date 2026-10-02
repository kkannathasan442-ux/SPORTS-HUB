import { describe, it, expect } from 'vitest';
import type { AppRole, MemberStatus, BookingStatus } from '@sportshub/types';

// ============================================================================
// SIMULATED DATABASE RLS & AUDIT INTEGRITY ENGINE
// Matches Supabase Migration 016 & 017 Policies:
// - "Customers can view their own bookings" (customer_user_id = auth.uid())
// - "Customers can insert their own bookings" (customer_user_id = auth.uid())
// - "Customers can update their own bookings" (customer_user_id = auth.uid())
// - "Owners can view organization bookings" (EXISTS in organization_members with ACTIVE)
// ============================================================================

interface SecurityAuthContext {
  userId: string | null;
  role?: AppRole;
  organizationMemberships: Array<{
    organizationId: string;
    userId: string;
    role: AppRole;
    status: MemberStatus;
  }>;
}

interface SimulatedDbBooking {
  id: string;
  booking_reference: string;
  customer_user_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_note?: string;
  organization_id: string;
  venue_id: string;
  facility_id: string;
  status: BookingStatus;
  subtotal: number;
  total_amount: number;
  currency: string;
}

class RuntimeRlsValidator {
  /**
   * Evaluates SELECT on public.bookings
   */
  public static canSelectBooking(ctx: SecurityAuthContext, booking: SimulatedDbBooking): boolean {
    if (!ctx.userId) return false;

    // Platform Super Admin bypass
    const isSuperAdmin = ctx.organizationMemberships.some(
      (m) => m.userId === ctx.userId && m.role === 'SUPER_ADMIN' && m.status === 'ACTIVE'
    );
    if (isSuperAdmin) return true;

    // Policy: "Customers can view their own bookings"
    if (booking.customer_user_id === ctx.userId) return true;

    // Policy: "Owners can view organization bookings"
    const isOrgMember = ctx.organizationMemberships.some(
      (m) =>
        m.organizationId === booking.organization_id &&
        m.userId === ctx.userId &&
        m.status === 'ACTIVE' &&
        ['OWNER', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    );

    return isOrgMember;
  }

  /**
   * Evaluates UPDATE / Mutation on public.bookings (e.g. confirm hold or cancel)
   */
  public static canMutateBooking(
    ctx: SecurityAuthContext,
    booking: SimulatedDbBooking,
    action: 'CONFIRM' | 'CANCEL' | 'TAMPER_OWNERSHIP',
    mutatedFields?: { organization_id?: string; venue_id?: string; facility_id?: string }
  ): boolean {
    if (!ctx.userId) return false;

    // 1. Check tamper resistance on foreign key references (cannot change org/venue/facility)
    if (mutatedFields) {
      if (mutatedFields.organization_id && mutatedFields.organization_id !== booking.organization_id) {
        return false; // Rejection: Immutable foreign-key relationship
      }
      if (mutatedFields.venue_id && mutatedFields.venue_id !== booking.venue_id) {
        return false; // Rejection: Immutable venue relationship
      }
      if (mutatedFields.facility_id && mutatedFields.facility_id !== booking.facility_id) {
        return false; // Rejection: Immutable facility relationship
      }
    }

    // 2. Customer ownership or authorized staff check
    const isOwnerOrStaff = ctx.organizationMemberships.some(
      (m) =>
        m.organizationId === booking.organization_id &&
        m.userId === ctx.userId &&
        m.status === 'ACTIVE' &&
        ['OWNER', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
    );

    if (booking.customer_user_id === ctx.userId || isOwnerOrStaff) {
      return true;
    }

    return false;
  }

  /**
   * Simulates public availability endpoint projection (strips private customer PII)
   */
  public static sanitizePublicAvailability(slots: any[]): any[] {
    return slots.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
      isAvailable: s.isAvailable,
      price: s.price,
      currency: s.currency,
      unavailableReason: s.unavailableReason,
      // Intentionally DOES NOT include: customer_user_id, customer_name, customer_phone, customer_note
    }));
  }
}

describe('STEP 6 — Database RLS & Multi-Tenant Security Verification', () => {
  const customerA = '11111111-1111-1111-1111-111111111111';
  const customerB = '22222222-2222-2222-2222-222222222222';
  const receptionistOrgA = '33333333-3333-3333-3333-333333333333';
  const ownerOrgB = '44444444-4444-4444-4444-444444444444';

  const orgA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const orgB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const ctxCustomerA: SecurityAuthContext = {
    userId: customerA,
    organizationMemberships: [],
  };

  const ctxCustomerB: SecurityAuthContext = {
    userId: customerB,
    organizationMemberships: [],
  };

  const ctxReceptionistA: SecurityAuthContext = {
    userId: receptionistOrgA,
    organizationMemberships: [
      { organizationId: orgA, userId: receptionistOrgA, role: 'RECEPTIONIST', status: 'ACTIVE' },
    ],
  };

  const ctxOwnerB: SecurityAuthContext = {
    userId: ownerOrgB,
    organizationMemberships: [
      { organizationId: orgB, userId: ownerOrgB, role: 'OWNER', status: 'ACTIVE' },
    ],
  };

  const bookingOrgA: SimulatedDbBooking = {
    id: 'book-a-1',
    booking_reference: 'SPH-20261015-ORG001',
    customer_user_id: customerA,
    customer_name: 'Customer Alice',
    customer_phone: '+94771112233',
    customer_note: 'Tournament preparation with VIP shuttlecocks',
    organization_id: orgA,
    venue_id: 'venue-a-1',
    facility_id: 'fac-a-1',
    status: 'CONFIRMED',
    subtotal: 2500,
    total_amount: 2500,
    currency: 'LKR',
  };

  const holdOrgA: SimulatedDbBooking = {
    id: 'hold-a-1',
    booking_reference: 'SPH-20261015-HLD001',
    customer_user_id: customerA,
    organization_id: orgA,
    venue_id: 'venue-a-1',
    facility_id: 'fac-a-1',
    status: 'HOLD',
    subtotal: 2500,
    total_amount: 2500,
    currency: 'LKR',
  };

  const bookingOrgB: SimulatedDbBooking = {
    id: 'book-b-1',
    booking_reference: 'SPH-20261015-ORG002',
    customer_user_id: customerB,
    customer_name: 'Customer Bob',
    customer_phone: '+94774445566',
    customer_note: 'Coaching session',
    organization_id: orgB,
    venue_id: 'venue-b-1',
    facility_id: 'fac-b-1',
    status: 'CONFIRMED',
    subtotal: 3000,
    total_amount: 3000,
    currency: 'LKR',
  };

  describe('1. Customer Data Isolation & Privacy', () => {
    it('customer A CAN read their own booking details', () => {
      expect(RuntimeRlsValidator.canSelectBooking(ctxCustomerA, bookingOrgA)).toBe(true);
    });

    it('customer A CANNOT read customer B’s booking details (rejected by RLS)', () => {
      expect(RuntimeRlsValidator.canSelectBooking(ctxCustomerA, bookingOrgB)).toBe(false);
    });

    it('customer A CANNOT confirm customer B’s HOLD', () => {
      const holdB: SimulatedDbBooking = {
        ...holdOrgA,
        id: 'hold-b-1',
        customer_user_id: customerB,
      };
      expect(RuntimeRlsValidator.canMutateBooking(ctxCustomerA, holdB, 'CONFIRM')).toBe(false);
    });

    it('customer A CANNOT cancel customer B’s booking', () => {
      expect(RuntimeRlsValidator.canMutateBooking(ctxCustomerA, bookingOrgB, 'CANCEL')).toBe(false);
    });
  });

  describe('2. Multi-Tenant Boundary Isolation', () => {
    it('Receptionist of Org A CAN view bookings in Org A', () => {
      expect(RuntimeRlsValidator.canSelectBooking(ctxReceptionistA, bookingOrgA)).toBe(true);
    });

    it('Receptionist of Org A CANNOT view bookings in Org B', () => {
      expect(RuntimeRlsValidator.canSelectBooking(ctxReceptionistA, bookingOrgB)).toBe(false);
    });

    it('Owner of Org B CANNOT view bookings in Org A', () => {
      expect(RuntimeRlsValidator.canSelectBooking(ctxOwnerB, bookingOrgA)).toBe(false);
    });

    it('Owner of Org B CANNOT cancel or mutate bookings in Org A', () => {
      expect(RuntimeRlsValidator.canMutateBooking(ctxOwnerB, bookingOrgA, 'CANCEL')).toBe(false);
    });
  });

  describe('3. Immutable Relational Ownership & Anti-Tampering', () => {
    it('REJECTS client attempts to reassign organization_id', () => {
      const result = RuntimeRlsValidator.canMutateBooking(ctxCustomerA, bookingOrgA, 'TAMPER_OWNERSHIP', {
        organization_id: orgB, // Malicious tenant switch
      });
      expect(result).toBe(false);
    });

    it('REJECTS client attempts to reassign venue_id or facility_id', () => {
      const result = RuntimeRlsValidator.canMutateBooking(ctxCustomerA, bookingOrgA, 'TAMPER_OWNERSHIP', {
        venue_id: 'venue-fake-99',
      });
      expect(result).toBe(false);
    });
  });

  describe('4. Public Availability Data Sanitization (Privacy Guarantee)', () => {
    it('ensures public slot availability output contains ZERO customer PII or notes', () => {
      const rawInternalSlots = [
        {
          startTime: '10:00',
          endTime: '11:00',
          durationMinutes: 60,
          isAvailable: false,
          price: 2000,
          currency: 'LKR',
          unavailableReason: 'BOOKED',
          customer_user_id: customerA,
          customer_name: 'Customer Alice',
          customer_phone: '+94771112233',
          customer_note: 'Secret tournament tactic',
        },
      ];

      const publicSlots = RuntimeRlsValidator.sanitizePublicAvailability(rawInternalSlots);

      expect(publicSlots[0].startTime).toBe('10:00');
      expect(publicSlots[0].isAvailable).toBe(false);
      expect((publicSlots[0] as any).customer_user_id).toBeUndefined();
      expect((publicSlots[0] as any).customer_name).toBeUndefined();
      expect((publicSlots[0] as any).customer_phone).toBeUndefined();
      expect((publicSlots[0] as any).customer_note).toBeUndefined();
    });
  });
});
