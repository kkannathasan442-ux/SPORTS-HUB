import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationDispatcher } from '../../apps/web/src/lib/notifications/dispatcher';
import { SandboxEmailProvider } from '../../apps/web/src/lib/notifications/sandbox-email-provider';
import type { BookingWithDetails, PaymentTransaction, RefundRecord } from '@sportshub/types';

describe('Notification Event Integration & Fault Isolation — STEP 8 Tests', () => {
  let sandboxEmailProvider: SandboxEmailProvider;
  let dispatcher: NotificationDispatcher;
  let mockSupabase: any;
  let insertedNotifications: any[];
  let userPreferences: Record<string, any>;

  beforeEach(() => {
    sandboxEmailProvider = new SandboxEmailProvider();
    dispatcher = new NotificationDispatcher(sandboxEmailProvider);
    insertedNotifications = [];
    userPreferences = {
      email_booking_confirmations: true,
      email_payment_receipts: true,
      email_hold_reminders: true,
      email_cancellations: true,
      in_app_enabled: true,
      promotional_emails: false,
    };

    // Mock Supabase client for unit integration
    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'notifications') {
          return {
            insert: vi.fn((data: any) => {
              const record = {
                id: crypto.randomUUID(),
                ...data,
                created_at: new Date().toISOString(),
                read_at: null,
                status: 'SENT',
              };
              insertedNotifications.push(record);
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: record, error: null }),
                })),
              };
            }),
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({
                data: insertedNotifications,
                error: null,
                count: insertedNotifications.length,
              }),
            })),
          };
        }

        if (table === 'notification_preferences') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: userPreferences, error: null }),
              })),
            })),
          };
        }

        if (table === 'payment_transactions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    customer_user_id: '550e8400-e29b-41d4-a716-446655440004',
                    organization_id: '550e8400-e29b-41d4-a716-446655440001',
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };
  });

  describe('1. Domain Event Notification Dispatches', () => {
    const mockBooking: BookingWithDetails = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      organization_id: '550e8400-e29b-41d4-a716-446655440001',
      venue_id: '550e8400-e29b-41d4-a716-446655440002',
      facility_id: '550e8400-e29b-41d4-a716-446655440003',
      customer_user_id: '550e8400-e29b-41d4-a716-446655440004',
      booking_reference: 'SPH-20261002-112233',
      booking_date: '2026-10-15',
      start_time: '14:00',
      end_time: '15:00',
      duration_minutes: 60,
      status: 'CONFIRMED',
      total_amount: 3000,
      currency: 'LKR',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      facility: { name: 'Court 1' },
      venue: { name: 'Premier Arena' },
      customer: { full_name: 'Amal Perera' },
    } as any;

    it('should dispatch booking hold created in-app notification', async () => {
      await dispatcher.dispatchBookingHoldCreated(mockSupabase, {
        ...mockBooking,
        status: 'HOLD',
        hold_expires_at: new Date(Date.now() + 600000).toISOString(),
      });

      expect(insertedNotifications.length).toBe(1);
      expect(insertedNotifications[0].notification_type).toBe('BOOKING_HOLD_CREATED');
      expect(insertedNotifications[0].recipient_user_id).toBe('550e8400-e29b-41d4-a716-446655440004');
      expect(insertedNotifications[0].idempotency_key).toContain('hold_created_550e8400-e29b-41d4-a716-446655440010');
    });

    it('should dispatch booking confirmed notification and send formatted email', async () => {
      await dispatcher.dispatchBookingConfirmed(mockSupabase, mockBooking, 'amal@example.com');

      expect(insertedNotifications.length).toBe(1);
      expect(insertedNotifications[0].notification_type).toBe('BOOKING_CONFIRMED');
      expect(insertedNotifications[0].recipient_user_id).toBe('550e8400-e29b-41d4-a716-446655440004');

      const outbox = sandboxEmailProvider.getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0].to).toBe('amal@example.com');
      expect(outbox[0].subject).toContain('SPH-20261002-112233');
    });

    it('should dispatch booking cancelled notification and send email', async () => {
      const cancelledBooking = {
        ...mockBooking,
        status: 'CANCELLED' as const,
        cancellation_reason: 'User requested',
      };

      await dispatcher.dispatchBookingCancelled(mockSupabase, cancelledBooking, 'amal@example.com');

      expect(insertedNotifications.length).toBe(1);
      expect(insertedNotifications[0].notification_type).toBe('BOOKING_CANCELLED');

      const outbox = sandboxEmailProvider.getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0].subject).toContain('Booking Cancelled');
    });

    it('should dispatch walk-in desk booking notification', async () => {
      const staffUserId = '550e8400-e29b-41d4-a716-446655440099';
      await dispatcher.dispatchWalkInBookingCreated(mockSupabase, mockBooking, staffUserId);

      expect(insertedNotifications.length).toBe(1);
      expect(insertedNotifications[0].notification_type).toBe('WALK_IN_BOOKING_CREATED');
      expect(insertedNotifications[0].recipient_user_id).toBe(staffUserId);
    });

    it('should dispatch payment success notification and email receipt', async () => {
      const mockTx: PaymentTransaction = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        booking_id: mockBooking.id,
        organization_id: mockBooking.organization_id,
        customer_user_id: mockBooking.customer_user_id,
        amount: 3000,
        currency: 'LKR',
        payment_method: 'CARD',
        status: 'SUCCESS',
        provider: 'SANDBOX',
        provider_transaction_id: 'prov_tx_555',
        idempotency_key: 'idem_tx_555',
        provider_reference: 'PROV-TX-999',
        failure_code: null,
        failure_message: null,
        metadata: {},
        refunded_amount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      await dispatcher.dispatchPaymentSuccess(
        mockSupabase,
        mockTx,
        'SPH-20261002-112233',
        'amal@example.com',
        'Amal Perera'
      );

      expect(insertedNotifications.length).toBe(1);
      expect(insertedNotifications[0].notification_type).toBe('PAYMENT_SUCCESS');

      const outbox = sandboxEmailProvider.getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0].to).toBe('amal@example.com');
      expect(outbox[0].subject).toContain('Payment Receipt');
    });

    it('should dispatch payment failed notification and warning email', async () => {
      const mockFailedTx: PaymentTransaction = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        booking_id: mockBooking.id,
        organization_id: mockBooking.organization_id,
        customer_user_id: mockBooking.customer_user_id,
        amount: 3000,
        currency: 'LKR',
        payment_method: 'CARD',
        status: 'FAILED',
        provider: 'SANDBOX',
        provider_transaction_id: 'prov_tx_failed_1',
        idempotency_key: 'idem_failed_1',
        provider_reference: null,
        failure_code: 'INSUFFICIENT_FUNDS',
        failure_message: 'Card declined by issuing bank',
        metadata: {},
        refunded_amount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
      };

      await dispatcher.dispatchPaymentFailed(
        mockSupabase,
        mockFailedTx,
        'SPH-20261002-112233',
        'amal@example.com'
      );

      expect(insertedNotifications.length).toBe(1);
      expect(insertedNotifications[0].notification_type).toBe('PAYMENT_FAILED');

      const outbox = sandboxEmailProvider.getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0].subject).toContain('Payment Unsuccessful');
    });

    it('should dispatch refund processed notification', async () => {
      const mockRefund: RefundRecord = {
        id: '550e8400-e29b-41d4-a716-446655440030',
        payment_transaction_id: '550e8400-e29b-41d4-a716-446655440020',
        booking_id: mockBooking.id,
        organization_id: mockBooking.organization_id,
        amount: 3000,
        currency: 'LKR',
        reason: 'Double charge dispute',
        status: 'SUCCESS',
        provider_refund_id: 'PROV-RFD-777',
        created_by: '550e8400-e29b-41d4-a716-446655440099',
        metadata: {},
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      await dispatcher.dispatchRefundProcessed(
        mockSupabase,
        mockRefund,
        'SPH-20261002-112233',
        'amal@example.com'
      );

      expect(insertedNotifications.length).toBe(1);
      expect(insertedNotifications[0].notification_type).toBe('REFUND_PROCESSED');

      const outbox = sandboxEmailProvider.getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0].subject).toContain('Refund Processed');
    });
  });

  describe('2. Fault Isolation Guarantee Tests', () => {
    it('should NEVER throw an error or crash the caller when email provider fails', async () => {
      sandboxEmailProvider.setSimulateFailure(true);

      const mockBooking = {
        id: '550e8400-e29b-41d4-a716-446655440040',
        organization_id: '550e8400-e29b-41d4-a716-446655440001',
        customer_user_id: '550e8400-e29b-41d4-a716-446655440004',
        booking_reference: 'SPH-FAULT-001',
        booking_date: '2026-10-15',
        start_time: '10:00',
        end_time: '11:00',
        duration_minutes: 60,
        total_amount: 1500,
        currency: 'LKR',
      } as any;

      // Must complete smoothly without throwing
      await expect(
        dispatcher.dispatchBookingConfirmed(mockSupabase, mockBooking, 'test@example.com')
      ).resolves.not.toThrow();

      // In-App notification was still successfully recorded
      expect(insertedNotifications.length).toBe(1);
    });

    it('should NEVER throw an error if database notification insertion errors', async () => {
      mockSupabase.from = vi.fn().mockImplementation(() => {
        throw new Error('Database connection timeout');
      });

      const mockBooking = {
        id: '550e8400-e29b-41d4-a716-446655440050',
        customer_user_id: '550e8400-e29b-41d4-a716-446655440004',
        booking_reference: 'SPH-DB-FAIL',
      } as any;

      // Must catch gracefully and not crash the business transaction
      await expect(
        dispatcher.dispatchBookingHoldCreated(mockSupabase, mockBooking)
      ).resolves.not.toThrow();
    });
  });

  describe('3. User Preference Logic Filtering', () => {
    it('should skip email dispatch when user has disabled booking confirmation emails', async () => {
      userPreferences.email_booking_confirmations = false;

      const mockBooking = {
        id: '550e8400-e29b-41d4-a716-446655440060',
        organization_id: '550e8400-e29b-41d4-a716-446655440001',
        customer_user_id: '550e8400-e29b-41d4-a716-446655440004',
        booking_reference: 'SPH-OPTOUT-001',
        booking_date: '2026-10-15',
        start_time: '10:00',
        end_time: '11:00',
        duration_minutes: 60,
        total_amount: 1500,
        currency: 'LKR',
      } as any;

      await dispatcher.dispatchBookingConfirmed(mockSupabase, mockBooking, 'optout@example.com');

      // IN_APP record is created
      expect(insertedNotifications.length).toBe(1);
      // But email is skipped
      expect(sandboxEmailProvider.getOutbox().length).toBe(0);
    });
  });
});
