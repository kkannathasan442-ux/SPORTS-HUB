import { describe, it, expect } from 'vitest';
import { createPaymentTransaction } from '../../apps/web/src/lib/payments/create-payment';
import { verifyPaymentTransaction } from '../../apps/web/src/lib/payments/verify-payment';
import { processPaymentRefund } from '../../apps/web/src/lib/payments/refund';
import { PAYMENT_ERRORS } from '../../apps/web/src/lib/payments/types';
import type { Booking, PaymentTransaction } from '@sportshub/types';

describe('STEP 7 — Payment Security, Tenant & RLS Isolation Tests', () => {
  const customerA = { id: 'usr-customer-a', email: 'customera@example.com' };
  const customerB = { id: 'usr-customer-b', email: 'customerb@example.com' };

  const orgA = '550e8400-e29b-41d4-a716-446655440001';
  const orgB = '550e8400-e29b-41d4-a716-446655440002';

  const bookingCustomerA: Booking = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    booking_reference: 'SPH-A-001',
    customer_user_id: customerA.id,
    customer_profile_id: null,
    organization_id: orgA,
    venue_id: 'venue-a',
    facility_id: 'facility-a',
    sport_id: 'sport-a',
    booking_date: '2026-10-15',
    start_time: '14:00:00',
    end_time: '15:00:00',
    duration_minutes: 60,
    protected_time_range: '["2026-10-15 14:00:00+00", "2026-10-15 15:00:00+00")',
    status: 'HOLD',
    subtotal: 4000,
    discount_amount: 0,
    total_amount: 4000,
    currency: 'LKR',
    price_snapshot: {
      baseRatePerHour: 4000,
      appliedRatePerHour: 4000,
      subtotal: 4000,
      currency: 'LKR',
      durationMinutes: 60,
      calculatedAt: '2026-10-02T10:00:00Z',
    },
    customer_note: null,
    cancellation_reason: null,
    cancelled_at: null,
    confirmed_at: null,
    hold_expires_at: new Date(Date.now() + 600000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const paymentCustomerA: PaymentTransaction = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    booking_id: bookingCustomerA.id,
    organization_id: orgA,
    customer_user_id: customerA.id,
    provider: 'SANDBOX',
    provider_transaction_id: 'sbx_sess_a',
    idempotency_key: 'idem_a',
    amount: 4000,
    currency: 'LKR',
    status: 'PENDING',
    payment_method: 'CARD',
    provider_reference: null,
    failure_code: null,
    failure_message: null,
    metadata: {},
    refunded_amount: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  };

  // ==========================================================================
  // 1. Cross-Customer Isolation
  // ==========================================================================
  describe('Cross-Customer Payment Isolation', () => {
    it('Customer B cannot initiate payment for Customer A booking', async () => {
      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: customerB }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: bookingCustomerA, error: null }),
            }),
          }),
        }),
      };

      const result = await createPaymentTransaction(mockSupabase, {
        bookingId: bookingCustomerA.id,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PAYMENT_ERRORS.UNAUTHORIZED);
    });

    it('Customer B cannot verify Customer A payment transaction', async () => {
      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: customerB }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: paymentCustomerA, error: null }),
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }), // Customer B is not a member of Org A
                }),
              }),
            }),
          }),
        }),
      };

      const result = await verifyPaymentTransaction(mockSupabase, {
        paymentTransactionId: paymentCustomerA.id,
        verificationToken: 'tok_valid',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PAYMENT_ERRORS.FORBIDDEN);
    });
  });

  // ==========================================================================
  // 2. Customer Refund Restriction
  // ==========================================================================
  describe('Customer Refund Privilege Protection', () => {
    it('regular customer cannot issue refund on their own transaction', async () => {
      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: customerA }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: paymentCustomerA, error: null }),
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }), // Customer has no staff role
                }),
              }),
            }),
          }),
        }),
      };

      const result = await processPaymentRefund(mockSupabase, {
        paymentTransactionId: paymentCustomerA.id,
        amount: 4000,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PAYMENT_ERRORS.FORBIDDEN);
    });
  });

  // ==========================================================================
  // 3. Cross-Tenant Financial Isolation
  // ==========================================================================
  describe('Cross-Tenant Organization Financial Isolation', () => {
    it('staff of Org B cannot issue refund for payment in Org A', async () => {
      const staffOrgB = { id: 'staff-org-b', email: 'owner@orgb.com' };

      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: staffOrgB }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: paymentCustomerA, error: null }),
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }), // Staff member belongs to Org B, not Org A
                }),
              }),
            }),
          }),
        }),
      };

      const result = await processPaymentRefund(mockSupabase, {
        paymentTransactionId: paymentCustomerA.id,
        amount: 2000,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PAYMENT_ERRORS.FORBIDDEN);
    });
  });

  // ==========================================================================
  // 4. Unauthenticated Public Access Rejection
  // ==========================================================================
  describe('Unauthenticated Public Access Protection', () => {
    it('rejects unauthenticated payment creation attempts', async () => {
      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      };

      const result = await createPaymentTransaction(mockSupabase, {
        bookingId: bookingCustomerA.id,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PAYMENT_ERRORS.UNAUTHORIZED);
    });
  });
});
