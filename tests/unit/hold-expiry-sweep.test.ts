import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sweepExpiringHolds } from '../../apps/web/src/lib/notifications/hold-expiry-sweep';
import { NotificationDispatcher } from '../../apps/web/src/lib/notifications/dispatcher';
import { SandboxEmailProvider } from '../../apps/web/src/lib/notifications/sandbox-email-provider';

describe('STEP 8 — Hold Expiry Reminder Sweep, Concurrency & Idempotency Tests', () => {
  let sandboxEmailProvider: SandboxEmailProvider;
  let dispatcher: NotificationDispatcher;
  let inMemoryNotifications: any[] = [];
  let inMemoryBookings: any[] = [];

  const orgId = '550e8400-e29b-41d4-a716-446655440000';
  const customerId = 'usr-cust-001';

  beforeEach(() => {
    sandboxEmailProvider = new SandboxEmailProvider();
    dispatcher = new NotificationDispatcher(sandboxEmailProvider);
    inMemoryNotifications = [];

    const now = Date.now();
    inMemoryBookings = [
      // 1. Active hold expiring in 2 minutes (ELIGIBLE for reminder)
      {
        id: 'hold-exp-1',
        booking_reference: 'SPH-EXP-001',
        customer_user_id: customerId,
        organization_id: orgId,
        venue_id: 'v-1',
        facility_id: 'f-1',
        sport_id: 's-1',
        booking_date: '2026-10-15',
        start_time: '14:00',
        end_time: '15:00',
        duration_minutes: 60,
        status: 'HOLD',
        subtotal: 2000,
        total_amount: 2000,
        currency: 'LKR',
        hold_expires_at: new Date(now + 2 * 60 * 1000).toISOString(),
        venue: { name: 'Colombo Arena' },
        facility: { name: 'Court 1' },
        customer: { full_name: 'Test Customer', phone: '+94770000000' },
      },
      // 2. Active hold expiring in 8 minutes (NOT within 3-min reminder window)
      {
        id: 'hold-far-2',
        booking_reference: 'SPH-FAR-002',
        customer_user_id: customerId,
        organization_id: orgId,
        venue_id: 'v-1',
        facility_id: 'f-1',
        sport_id: 's-1',
        booking_date: '2026-10-15',
        start_time: '16:00',
        end_time: '17:00',
        duration_minutes: 60,
        status: 'HOLD',
        subtotal: 2000,
        total_amount: 2000,
        currency: 'LKR',
        hold_expires_at: new Date(now + 8 * 60 * 1000).toISOString(),
        venue: { name: 'Colombo Arena' },
        facility: { name: 'Court 1' },
        customer: { full_name: 'Test Customer', phone: '+94770000000' },
      },
      // 3. Already expired hold (NOT ELIGIBLE for reminder)
      {
        id: 'hold-expired-3',
        booking_reference: 'SPH-EXP-003',
        customer_user_id: customerId,
        organization_id: orgId,
        venue_id: 'v-1',
        facility_id: 'f-1',
        sport_id: 's-1',
        booking_date: '2026-10-15',
        start_time: '10:00',
        end_time: '11:00',
        duration_minutes: 60,
        status: 'HOLD',
        subtotal: 2000,
        total_amount: 2000,
        currency: 'LKR',
        hold_expires_at: new Date(now - 1 * 60 * 1000).toISOString(),
        venue: { name: 'Colombo Arena' },
        facility: { name: 'Court 1' },
        customer: { full_name: 'Test Customer', phone: '+94770000000' },
      },
      // 4. Confirmed booking (NOT a hold)
      {
        id: 'conf-4',
        booking_reference: 'SPH-CONF-004',
        customer_user_id: customerId,
        organization_id: orgId,
        venue_id: 'v-1',
        facility_id: 'f-1',
        sport_id: 's-1',
        booking_date: '2026-10-15',
        start_time: '18:00',
        end_time: '19:00',
        duration_minutes: 60,
        status: 'CONFIRMED',
        subtotal: 2000,
        total_amount: 2000,
        currency: 'LKR',
        hold_expires_at: null,
        venue: { name: 'Colombo Arena' },
        facility: { name: 'Court 1' },
        customer: { full_name: 'Test Customer', phone: '+94770000000' },
      },
      // 5. Cancelled booking
      {
        id: 'cancel-5',
        booking_reference: 'SPH-CANC-005',
        customer_user_id: customerId,
        organization_id: orgId,
        venue_id: 'v-1',
        facility_id: 'f-1',
        sport_id: 's-1',
        booking_date: '2026-10-15',
        start_time: '20:00',
        end_time: '21:00',
        duration_minutes: 60,
        status: 'CANCELLED',
        subtotal: 2000,
        total_amount: 2000,
        currency: 'LKR',
        hold_expires_at: new Date(now + 2 * 60 * 1000).toISOString(),
        venue: { name: 'Colombo Arena' },
        facility: { name: 'Court 1' },
        customer: { full_name: 'Test Customer', phone: '+94770000000' },
      },
    ];
  });

  const createMockSupabase = () => {
    return {
      from: (table: string) => {
        if (table === 'bookings') {
          return {
            select: () => {
              const chain = {
                eq: (col: string, val: any) => {
                  return {
                    gt: (col2: string, nowIso: string) => {
                      return {
                        lte: async (col3: string, maxIso: string) => {
                          // Filter bookings matching status = 'HOLD' AND hold_expires_at > now AND hold_expires_at <= maxIso
                          const matches = inMemoryBookings.filter(
                            (b) =>
                              b.status === val &&
                              b.hold_expires_at &&
                              b.hold_expires_at > nowIso &&
                              b.hold_expires_at <= maxIso
                          );
                          return { data: matches, error: null };
                        },
                      };
                    },
                  };
                },
              };
              return chain;
            },
          };
        }

        if (table === 'notifications') {
          return {
            insert: (payload: any) => ({
              select: () => ({
                single: async () => {
                  // Check uniqueness of idempotency_key
                  const exists = inMemoryNotifications.find(
                    (n) => n.idempotency_key === payload.idempotency_key
                  );
                  if (exists) {
                    return {
                      data: null,
                      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                    };
                  }
                  const record = {
                    id: `notif-${Date.now()}-${Math.random()}`,
                    ...payload,
                    read_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  inMemoryNotifications.push(record);
                  return { data: record, error: null };
                },
              }),
            }),
            select: () => ({
              eq: (col: string, val: any) => ({
                single: async () => {
                  const found = inMemoryNotifications.find((n) => n[col] === val);
                  return { data: found || null, error: null };
                },
                maybeSingle: async () => {
                  const found = inMemoryNotifications.find((n) => n[col] === val);
                  return { data: found || null, error: null };
                },
              }),
            }),
          };
        }

        if (table === 'notification_preferences') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    user_id: customerId,
                    booking_emails: true,
                    payment_emails: true,
                    hold_reminders: true,
                    cancellation_emails: true,
                    in_app_notifications: true,
                    marketing_emails: false,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {} as any;
      },
    } as any;
  };

  it('1. identifies active holds nearing expiry and dispatches reminder', async () => {
    const mockSupabase = createMockSupabase();
    const result = await sweepExpiringHolds(mockSupabase, {
      windowMinutes: 3,
      dispatcher,
    });

    expect(result.checkedCount).toBe(1);
    expect(result.remindersDispatched).toBe(1);
    expect(result.errors.length).toBe(0);

    // Verify notification was created
    expect(inMemoryNotifications.length).toBe(1);
    expect(inMemoryNotifications[0].notification_type).toBe('BOOKING_HOLD_EXPIRING');
    expect(inMemoryNotifications[0].related_entity_id).toBe('hold-exp-1');
  });

  it('2. ignores expired, confirmed, and cancelled bookings during sweep', async () => {
    const mockSupabase = createMockSupabase();
    await sweepExpiringHolds(mockSupabase, {
      windowMinutes: 3,
      dispatcher,
    });

    const reminderEntityIds = inMemoryNotifications.map((n) => n.related_entity_id);
    expect(reminderEntityIds).toContain('hold-exp-1');
    expect(reminderEntityIds).not.toContain('hold-expired-3'); // Expired hold skipped
    expect(reminderEntityIds).not.toContain('conf-4'); // Confirmed booking skipped
    expect(reminderEntityIds).not.toContain('cancel-5'); // Cancelled booking skipped
  });

  it('3. ensures repeated sweeps within the expiry window create EXACTLY 1 reminder (Idempotency Proof)', async () => {
    const mockSupabase = createMockSupabase();

    // First sweep
    const result1 = await sweepExpiringHolds(mockSupabase, { windowMinutes: 3, dispatcher });
    expect(result1.remindersDispatched).toBe(1);
    expect(inMemoryNotifications.length).toBe(1);

    // Second sweep (simulating repeated scheduler execution 30 seconds later)
    const result2 = await sweepExpiringHolds(mockSupabase, { windowMinutes: 3, dispatcher });
    expect(result2.remindersDispatched).toBe(1); // Caught gracefully by unique idempotency key
    expect(inMemoryNotifications.length).toBe(1); // NO DUPLICATE RECORD CREATED

    // Third sweep
    const result3 = await sweepExpiringHolds(mockSupabase, { windowMinutes: 3, dispatcher });
    expect(result3.remindersDispatched).toBe(1);
    expect(inMemoryNotifications.length).toBe(1); // STILL EXACTLY 1
  });

  it('4. ensures concurrent sweeps executed in parallel create only 1 notification', async () => {
    const mockSupabase = createMockSupabase();

    // Run 5 simultaneous sweep operations
    await Promise.all([
      sweepExpiringHolds(mockSupabase, { windowMinutes: 3, dispatcher }),
      sweepExpiringHolds(mockSupabase, { windowMinutes: 3, dispatcher }),
      sweepExpiringHolds(mockSupabase, { windowMinutes: 3, dispatcher }),
      sweepExpiringHolds(mockSupabase, { windowMinutes: 3, dispatcher }),
      sweepExpiringHolds(mockSupabase, { windowMinutes: 3, dispatcher }),
    ]);

    expect(inMemoryNotifications.length).toBe(1);
    expect(inMemoryNotifications[0].idempotency_key).toBe('hold_expiring_hold-exp-1_usr-cust-001_inapp');
  });
});
