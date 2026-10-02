import { describe, it, expect } from 'vitest';
import { createPaymentTransaction } from '../../apps/web/src/lib/payments/create-payment';
import { verifyPaymentTransaction } from '../../apps/web/src/lib/payments/verify-payment';
import { processPaymentRefund } from '../../apps/web/src/lib/payments/refund';
import type { Booking, PaymentTransaction } from '@sportshub/types';

describe('STEP 7 — Payment Concurrency & Idempotency Tests', () => {
  const mockUser = {
    id: 'user-concurrent-111',
    email: 'concurrent@example.com',
    user_metadata: { full_name: 'Concurrent Customer' },
  };

  const mockBooking: Booking = {
    id: '550e8400-e29b-41d4-a716-446655440050',
    booking_reference: 'SPH-CONC-001',
    customer_user_id: mockUser.id,
    customer_profile_id: null,
    organization_id: 'org-conc-1',
    venue_id: 'venue-conc-1',
    facility_id: 'facility-conc-1',
    sport_id: 'sport-conc-1',
    booking_date: '2026-10-15',
    start_time: '18:00:00',
    end_time: '19:00:00',
    duration_minutes: 60,
    protected_time_range: '["2026-10-15 18:00:00+00", "2026-10-15 19:00:00+00")',
    status: 'HOLD',
    subtotal: 5000,
    discount_amount: 0,
    total_amount: 5000,
    currency: 'LKR',
    price_snapshot: {
      baseRatePerHour: 5000,
      appliedRatePerHour: 5000,
      subtotal: 5000,
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

  it('handles simultaneous duplicate creation requests idempotently without double-creation', async () => {
    const memoryTransactions: PaymentTransaction[] = [];
    const idempotencyKey = 'concurrent-idem-key-999';

    const createMockSupabase = () => ({
      auth: {
        getUser: async () => ({ data: { user: mockUser }, error: null }),
      },
      from: (table: string) => ({
        select: () => {
          const chain: any = {
            eq: (_field: string, val: string) => {
              const inner: any = {
                eq: () => inner,
                single: async () => {
                  if (table === 'bookings') return { data: mockBooking, error: null };
                  const found = memoryTransactions.find((t) => t.id === val || t.idempotency_key === val);
                  return { data: found || null, error: null };
                },
                maybeSingle: async () => {
                  if (table === 'bookings') return { data: mockBooking, error: null };
                  const found = memoryTransactions.find((t) => t.id === val || t.idempotency_key === val);
                  return { data: found || null, error: null };
                },
              };
              return inner;
            },
          };
          return chain;
        },
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              // Simulate PostgreSQL unique constraint on idempotency_key
              const exists = memoryTransactions.find((t) => t.idempotency_key === row.idempotency_key);
              if (exists) {
                return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
              }
              memoryTransactions.push(row);
              return { data: row, error: null };
            },
          }),
        }),
      }),
    });

    // Fire 2 concurrent requests with identical idempotencyKey
    const [res1, res2] = await Promise.all([
      createPaymentTransaction(createMockSupabase() as any, {
        bookingId: mockBooking.id,
        idempotencyKey,
      }),
      createPaymentTransaction(createMockSupabase() as any, {
        bookingId: mockBooking.id,
        idempotencyKey,
      }),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.transaction?.idempotency_key).toBe(idempotencyKey);
    expect(res2.transaction?.idempotency_key).toBe(idempotencyKey);
    // Exactly 1 database transaction was created
    expect(memoryTransactions.length).toBe(1);
  });

  it('handles simultaneous verification requests idempotently', async () => {
    const memoryTx: PaymentTransaction = {
      id: '550e8400-e29b-41d4-a716-446655440088',
      booking_id: mockBooking.id,
      organization_id: mockBooking.organization_id,
      customer_user_id: mockUser.id,
      provider: 'SANDBOX',
      provider_transaction_id: 'sbx_sess_conc',
      idempotency_key: 'idem_verify_conc',
      amount: 5000,
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

    const createMockSupabase = () => ({
      auth: {
        getUser: async () => ({ data: { user: mockUser }, error: null }),
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              if (table === 'payment_transactions') return { data: memoryTx, error: null };
              if (table === 'bookings') return { data: mockBooking, error: null };
              return { data: null, error: null };
            },
          }),
        }),
        update: (updates: any) => ({
          eq: () => ({
            select: () => ({
              single: async () => {
                Object.assign(memoryTx, updates);
                return { data: memoryTx, error: null };
              },
            }),
            then: async (resolve: any) => resolve ? resolve({ data: null, error: null }) : undefined,
          }),
        }),
      }),
    });

    const [v1, v2] = await Promise.all([
      verifyPaymentTransaction(createMockSupabase() as any, {
        paymentTransactionId: memoryTx.id,
        verificationToken: 'tok_valid',
      }),
      verifyPaymentTransaction(createMockSupabase() as any, {
        paymentTransactionId: memoryTx.id,
        verificationToken: 'tok_valid',
      }),
    ]);

    expect(v1.success).toBe(true);
    expect(v2.success).toBe(true);
    expect(memoryTx.status).toBe('SUCCESS');
    expect(memoryTx.provider_reference).toBeDefined();
  });
});
