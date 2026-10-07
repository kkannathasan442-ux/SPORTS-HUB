import { describe, it, expect } from 'vitest';
import {
  createPaymentSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
  paymentQuerySchema,
  paymentStatusSchema,
  paymentMethodSchema,
} from '@sportshub/validation';
import { SandboxPaymentProvider } from '../../apps/web/src/lib/payments/sandbox-provider';
import { createPaymentTransaction } from '../../apps/web/src/lib/payments/create-payment';
import { verifyPaymentTransaction } from '../../apps/web/src/lib/payments/verify-payment';
import { processPaymentRefund } from '../../apps/web/src/lib/payments/refund';
import { PAYMENT_ERRORS } from '../../apps/web/src/lib/payments/types';
import type { Booking, PaymentTransaction } from '@sportshub/types';

describe('STEP 7 — Payment & Transaction Management Engine Unit Tests', () => {
  const mockUser = {
    id: 'user-customer-111',
    email: 'customer@example.com',
    user_metadata: { full_name: 'Test Customer' },
  };

  const mockBooking: Booking = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    booking_reference: 'SPH-202610-ABCD',
    customer_user_id: 'user-customer-111',
    customer_profile_id: null,
    organization_id: 'org-111',
    venue_id: 'venue-111',
    facility_id: 'facility-111',
    sport_id: 'sport-111',
    booking_date: '2026-10-15',
    start_time: '18:00:00',
    end_time: '19:00:00',
    duration_minutes: 60,
    protected_time_range: '["2026-10-15 18:00:00+00", "2026-10-15 19:00:00+00")',
    status: 'HOLD',
    subtotal: 3500,
    discount_amount: 0,
    total_amount: 3500,
    currency: 'LKR',
    price_snapshot: {
      baseRatePerHour: 3500,
      appliedRatePerHour: 3500,
      subtotal: 3500,
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

  // ==========================================================================
  // 1. Zod Validation Schemas
  // ==========================================================================
  describe('Payment Validation Schemas', () => {
    it('validates correct create payment payload', () => {
      const payload = {
        bookingId: '550e8400-e29b-41d4-a716-446655440000',
        paymentMethod: 'CARD',
        idempotencyKey: 'idem_key_123',
      };

      const res = createPaymentSchema.safeParse(payload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.paymentMethod).toBe('CARD');
      }
    });

    it('rejects invalid booking UUID in create payment schema', () => {
      const invalid = {
        bookingId: 'invalid-uuid-123',
        paymentMethod: 'CARD',
      };
      expect(createPaymentSchema.safeParse(invalid).success).toBe(false);
    });

    it('validates verify payment schema', () => {
      const valid = {
        paymentTransactionId: '550e8400-e29b-41d4-a716-446655440000',
        verificationToken: 'tok_test_success',
      };
      expect(verifyPaymentSchema.safeParse(valid).success).toBe(true);
    });

    it('validates refund payment schema with positive amount', () => {
      const valid = {
        paymentTransactionId: '550e8400-e29b-41d4-a716-446655440000',
        amount: 1500,
        reason: 'Customer cancelled early',
      };
      expect(refundPaymentSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects non-positive refund amount in validation schema', () => {
      const invalid = {
        paymentTransactionId: '550e8400-e29b-41d4-a716-446655440000',
        amount: -500,
      };
      expect(refundPaymentSchema.safeParse(invalid).success).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Provider Abstraction & Sandbox Adapter
  // ==========================================================================
  describe('Sandbox Payment Provider Adapter', () => {
    const provider = new SandboxPaymentProvider();

    it('creates a session with deterministic transaction identifiers', async () => {
      const session = await provider.createPaymentSession({
        transactionId: '550e8400-e29b-41d4-a716-446655440000',
        amount: 3500,
        currency: 'LKR',
        bookingReference: 'SPH-TEST-001',
      });

      expect(session.providerTransactionId).toContain('sbx_sess_');
      expect(session.clientSecret).toBeDefined();
      expect(session.checkoutUrl).toBeDefined();
    });

    it('verifies valid token with verified reference', async () => {
      const res = await provider.verifyPayment({
        transactionId: '550e8400-e29b-41d4-a716-446655440000',
        verificationToken: 'tok_valid_test',
      });

      expect(res.success).toBe(true);
      expect(res.providerReference).toContain('SBX-REF-');
    });

    it('declines verification when fail token is passed', async () => {
      const res = await provider.verifyPayment({
        transactionId: '550e8400-e29b-41d4-a716-446655440000',
        verificationToken: 'tok_fail_declined',
      });

      expect(res.success).toBe(false);
      expect(res.failureCode).toBe('CARD_DECLINED');
    });

    it('processes refund via sandbox adapter', async () => {
      const res = await provider.refundPayment({
        transactionId: '550e8400-e29b-41d4-a716-446655440000',
        providerTransactionId: 'sbx_sess_123',
        refundAmount: 1500,
        currency: 'LKR',
      });

      expect(res.success).toBe(true);
      expect(res.providerRefundId).toContain('sbx_rfd_');
    });
  });

  // ==========================================================================
  // 3. Server-Authoritative Price Calculation & Anti-Tampering
  // ==========================================================================
  describe('Server-Authoritative Price Calculation & Anti-Tampering', () => {
    it('creates payment transaction strictly using booking.total_amount', async () => {
      const mockDb: any = {
        payment_transactions: [],
        bookings: [mockBooking],
      };

      const createMockQuery = (data: any) => {
        const query: any = {
          _data: data,
          eq(_field: string, _val: any) {
            return this;
          },
          async single() {
            return { data: Array.isArray(this._data) ? this._data[0] : this._data, error: null };
          },
          async maybeSingle() {
            return { data: null, error: null };
          },
        };
        return query;
      };

      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: mockUser }, error: null }),
        },
        from: (table: string) => ({
          select: () => createMockQuery(mockDb[table]),
          insert: (row: any) => ({
            select: () => ({
              single: async () => {
                mockDb[table].push(row);
                return { data: row, error: null };
              },
            }),
          }),
        }),
      };

      // Client passes input (even if malicious client attempted to inject amount: 1)
      const input = {
        bookingId: mockBooking.id,
        paymentMethod: 'CARD' as const,
      };

      const result = await createPaymentTransaction(mockSupabase, input);

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(3500); // Server used authoritative 3500 LKR
      expect(result.transaction?.currency).toBe('LKR');
      expect(result.transaction?.status).toBe('PENDING');
    });

    it('rejects payment creation for cancelled or expired booking', async () => {
      const expiredBooking = {
        ...mockBooking,
        status: 'EXPIRED' as const,
      };

      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: mockUser }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: expiredBooking, error: null }),
            }),
          }),
        }),
      };

      const result = await createPaymentTransaction(mockSupabase, {
        bookingId: mockBooking.id,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PAYMENT_ERRORS.BOOKING_NOT_PAYABLE);
    });
  });

  // ==========================================================================
  // 4. Idempotency Protection
  // ==========================================================================
  describe('Idempotency Handling', () => {
    it('returns existing transaction on duplicate request with same idempotency key', async () => {
      const existingTx: PaymentTransaction = {
        id: 'tx-existing-111',
        booking_id: mockBooking.id,
        organization_id: mockBooking.organization_id,
        customer_user_id: mockUser.id,
        provider: 'SANDBOX',
        provider_transaction_id: 'sbx_sess_111',
        idempotency_key: 'idem_duplicate_test',
        amount: 3500,
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

      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: mockUser }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: (field: string, val: string) => {
              const chain: any = {
                eq: () => chain,
                single: async () => ({ data: table === 'bookings' ? mockBooking : existingTx, error: null }),
                maybeSingle: async () => {
                  if (field === 'idempotency_key' && val === 'idem_duplicate_test') {
                    return { data: existingTx, error: null };
                  }
                  return { data: null, error: null };
                },
              };
              return chain;
            },
          }),
        }),
      };

      const result = await createPaymentTransaction(mockSupabase, {
        bookingId: mockBooking.id,
        idempotencyKey: 'idem_duplicate_test',
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.id).toBe('tx-existing-111');
      expect(result.transaction?.idempotency_key).toBe('idem_duplicate_test');
    });
  });

  // ==========================================================================
  // 5. Verification & Status Synchronization
  // ==========================================================================
  describe('Verification & State Synchronization', () => {
    it('updates transaction to SUCCESS and confirms HOLD booking on verified payment', async () => {
      let bookingUpdated = false;
      let txUpdated = false;

      const pendingTx: PaymentTransaction = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        booking_id: mockBooking.id,
        organization_id: mockBooking.organization_id,
        customer_user_id: mockUser.id,
        provider: 'SANDBOX',
        provider_transaction_id: 'sbx_sess_123',
        idempotency_key: 'idem_verify_1',
        amount: 3500,
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

      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: mockUser }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => {
                if (table === 'payment_transactions') return { data: pendingTx, error: null };
                if (table === 'bookings') return { data: mockBooking, error: null };
                return { data: null, error: null };
              },
              maybeSingle: async () => {
                if (table === 'payment_transactions') return { data: pendingTx, error: null };
                if (table === 'bookings') return { data: mockBooking, error: null };
                return { data: null, error: null };
              },
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'notif-1' }, error: null }),
              maybeSingle: async () => ({ data: { id: 'notif-1' }, error: null }),
            }),
          }),
          update: (updates: any) => ({
            eq: () => ({
              select: () => ({
                single: async () => {
                  if (table === 'payment_transactions') {
                    txUpdated = true;
                    return { data: { ...pendingTx, ...updates }, error: null };
                  }
                  return { data: null, error: null };
                },
              }),
              then: async (resolve: any) => {
                if (table === 'bookings') bookingUpdated = true;
                return resolve ? resolve({ data: null, error: null }) : undefined;
              },
            }),
          }),
        }),
      };

      const result = await verifyPaymentTransaction(mockSupabase, {
        paymentTransactionId: pendingTx.id,
        verificationToken: 'tok_valid_test',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.transaction?.status).toBe('SUCCESS');
      expect(result.transaction?.provider_reference).toBeDefined();
      expect(txUpdated).toBe(true);
      expect(bookingUpdated).toBe(true);
    });

    it('records FAILED status when provider declines verification', async () => {
      const pendingTx: PaymentTransaction = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        booking_id: mockBooking.id,
        organization_id: mockBooking.organization_id,
        customer_user_id: mockUser.id,
        provider: 'SANDBOX',
        provider_transaction_id: 'sbx_sess_123',
        idempotency_key: 'idem_verify_fail',
        amount: 3500,
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

      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: mockUser }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: pendingTx, error: null }),
              maybeSingle: async () => ({ data: pendingTx, error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'notif-1' }, error: null }),
              maybeSingle: async () => ({ data: { id: 'notif-1' }, error: null }),
            }),
          }),
          update: (updates: any) => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: { ...pendingTx, ...updates }, error: null }),
              }),
            }),
          }),
        }),
      };

      const result = await verifyPaymentTransaction(mockSupabase, {
        paymentTransactionId: pendingTx.id,
        verificationToken: 'tok_fail_declined',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error?.code).toBe('CARD_DECLINED');
    });
  });

  // ==========================================================================
  // 6. Refund Foundation & Limits
  // ==========================================================================
  describe('Refund Foundation & Financial Invariants', () => {
    const successTx: PaymentTransaction = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      booking_id: mockBooking.id,
      organization_id: mockBooking.organization_id,
      customer_user_id: mockUser.id,
      provider: 'SANDBOX',
      provider_transaction_id: 'sbx_sess_success',
      idempotency_key: 'idem_refund_1',
      amount: 3500,
      currency: 'LKR',
      status: 'SUCCESS',
      payment_method: 'CARD',
      provider_reference: 'SBX-REF-12345',
      failure_code: null,
      failure_message: null,
      metadata: {},
      refunded_amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    it('rejects refund if refund amount exceeds available transaction amount', async () => {
      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: { id: 'staff-1', email: 'staff@example.com' } }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: successTx, error: null }),
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { role: 'OWNER' }, error: null }),
                }),
              }),
            }),
          }),
        }),
      };

      // Request 5000 refund on 3500 LKR payment
      const result = await processPaymentRefund(mockSupabase, {
        paymentTransactionId: successTx.id,
        amount: 5000,
        reason: 'Excessive refund test',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PAYMENT_ERRORS.REFUND_EXCEEDS_AMOUNT);
    });

    it('processes partial refund and updates status to PARTIALLY_REFUNDED', async () => {
      let refundInserted = false;
      let txUpdatedStatus = '';

      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: { id: 'staff-1', email: 'staff@example.com' } }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: successTx, error: null }),
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { role: 'OWNER' }, error: null }),
                }),
              }),
            }),
          }),
          insert: (row: any) => ({
            select: () => ({
              single: async () => {
                refundInserted = true;
                return { data: row, error: null };
              },
            }),
          }),
          update: (updates: any) => ({
            eq: () => ({
              select: () => ({
                single: async () => {
                  txUpdatedStatus = updates.status;
                  return { data: { ...successTx, ...updates }, error: null };
                },
              }),
            }),
          }),
        }),
      };

      const result = await processPaymentRefund(mockSupabase, {
        paymentTransactionId: successTx.id,
        amount: 1500,
        reason: 'Partial cancellation fee refund',
      });

      expect(result.success).toBe(true);
      expect(result.refund?.amount).toBe(1500);
      expect(result.transaction?.status).toBe('PARTIALLY_REFUNDED');
      expect(result.transaction?.refunded_amount).toBe(1500);
      expect(refundInserted).toBe(true);
      expect(txUpdatedStatus).toBe('PARTIALLY_REFUNDED');
    });

    it('rejects refund when transaction is already fully refunded', async () => {
      const fullyRefundedTx = {
        ...successTx,
        status: 'REFUNDED' as const,
        refunded_amount: 3500,
      };

      const mockSupabase: any = {
        auth: {
          getUser: async () => ({ data: { user: { id: 'staff-1', email: 'staff@example.com' } }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: fullyRefundedTx, error: null }),
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { role: 'OWNER' }, error: null }),
                }),
              }),
            }),
          }),
        }),
      };

      const result = await processPaymentRefund(mockSupabase, {
        paymentTransactionId: fullyRefundedTx.id,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PAYMENT_ERRORS.INVALID_STATUS_TRANSITION);
    });
  });
});
