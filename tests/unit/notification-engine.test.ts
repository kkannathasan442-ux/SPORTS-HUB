import { describe, it, expect, beforeEach } from 'vitest';
import {
  notificationTypeSchema,
  notificationChannelSchema,
  notificationStatusSchema,
  createNotificationSchema,
  updateNotificationPreferencesSchema,
  notificationQuerySchema,
} from '@sportshub/validation';
import {
  renderBookingConfirmationEmail,
  renderBookingCancellationEmail,
  renderPaymentSuccessEmail,
  renderPaymentFailureEmail,
  renderRefundProcessedEmail,
  renderBookingHoldExpiringEmail,
} from '../../apps/web/src/lib/notifications/email-templates';
import { SandboxEmailProvider } from '../../apps/web/src/lib/notifications/sandbox-email-provider';

describe('Notification Engine & Templates — STEP 8 Unit Tests', () => {
  let sandboxEmailProvider: SandboxEmailProvider;

  beforeEach(() => {
    sandboxEmailProvider = new SandboxEmailProvider();
    sandboxEmailProvider.clearOutbox();
  });

  describe('1. Schema & Validation Tests', () => {
    it('should validate allowed notification types', () => {
      expect(notificationTypeSchema.parse('BOOKING_CONFIRMED')).toBe('BOOKING_CONFIRMED');
      expect(notificationTypeSchema.parse('BOOKING_HOLD_CREATED')).toBe('BOOKING_HOLD_CREATED');
      expect(notificationTypeSchema.parse('BOOKING_HOLD_EXPIRING')).toBe('BOOKING_HOLD_EXPIRING');
      expect(notificationTypeSchema.parse('BOOKING_CANCELLED')).toBe('BOOKING_CANCELLED');
      expect(notificationTypeSchema.parse('WALK_IN_BOOKING_CREATED')).toBe('WALK_IN_BOOKING_CREATED');
      expect(notificationTypeSchema.parse('PAYMENT_SUCCESS')).toBe('PAYMENT_SUCCESS');
      expect(notificationTypeSchema.parse('PAYMENT_FAILED')).toBe('PAYMENT_FAILED');
      expect(notificationTypeSchema.parse('REFUND_PROCESSED')).toBe('REFUND_PROCESSED');
      expect(notificationTypeSchema.parse('SYSTEM_ALERT')).toBe('SYSTEM_ALERT');

      expect(() => notificationTypeSchema.parse('INVALID_TYPE')).toThrow();
    });

    it('should validate notification channels', () => {
      expect(notificationChannelSchema.parse('IN_APP')).toBe('IN_APP');
      expect(notificationChannelSchema.parse('EMAIL')).toBe('EMAIL');
      expect(notificationChannelSchema.parse('SMS')).toBe('SMS');
      expect(notificationChannelSchema.parse('PUSH')).toBe('PUSH');

      expect(() => notificationChannelSchema.parse('CARRIER_PIGEON')).toThrow();
    });

    it('should validate delivery status separately from read state', () => {
      expect(notificationStatusSchema.parse('PENDING')).toBe('PENDING');
      expect(notificationStatusSchema.parse('SENT')).toBe('SENT');
      expect(notificationStatusSchema.parse('DELIVERED')).toBe('DELIVERED');
      expect(notificationStatusSchema.parse('FAILED')).toBe('FAILED');

      // 'READ' is not a transport status
      expect(() => notificationStatusSchema.parse('READ')).toThrow();
    });

    it('should validate createNotificationSchema requirements', () => {
      const valid = {
        organizationId: 'a0000000-0000-0000-0000-000000000001',
        recipientUserId: 'c0000000-0000-0000-0000-000000000001',
        notificationType: 'BOOKING_CONFIRMED' as const,
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        relatedEntityType: 'booking',
        relatedEntityId: 'b0000000-0000-0000-0000-000000000001',
        channel: 'IN_APP' as const,
        idempotencyKey: 'booking_confirmed_b1_u1_inapp',
      };
      expect(createNotificationSchema.safeParse(valid).success).toBe(true);

      // Missing title or message
      expect(createNotificationSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
      expect(createNotificationSchema.safeParse({ ...valid, message: '' }).success).toBe(false);
    });

    it('should validate updateNotificationPreferencesSchema', () => {
      const validPrefs = {
        email_booking_confirmations: true,
        email_payment_receipts: false,
        email_hold_reminders: true,
        email_cancellations: true,
        in_app_enabled: true,
        promotional_emails: false,
      };
      expect(updateNotificationPreferencesSchema.safeParse(validPrefs).success).toBe(true);
    });

    it('should validate notification query parameters and enforce limits', () => {
      const validQuery = {
        page: 1,
        limit: 20,
        unreadOnly: true,
      };
      expect(notificationQuerySchema.safeParse(validQuery).success).toBe(true);

      const excessiveLimit = {
        limit: 500, // Max is 100
      };
      expect(notificationQuerySchema.safeParse(excessiveLimit).success).toBe(false);
    });
  });

  describe('2. Email Template Rendering Tests', () => {
    it('should render booking confirmation email with complete details', () => {
      const rendered = renderBookingConfirmationEmail({
        customerName: 'Ashan Silva',
        bookingReference: 'SPH-20261002-882311',
        venueName: 'Royal Sports Complex',
        facilityName: 'Badminton Court 1',
        bookingDate: '2026-10-15',
        startTime: '18:00',
        endTime: '19:00',
        durationMinutes: 60,
        totalAmount: 3500,
        currency: 'LKR',
      });

      expect(rendered.subject).toContain('SPH-20261002-882311');
      expect(rendered.subject).toContain('Booking Confirmed');
      expect(rendered.htmlContent).toContain('Ashan Silva');
      expect(rendered.htmlContent).toContain('Royal Sports Complex');
      expect(rendered.htmlContent).toContain('Badminton Court 1');
      expect(rendered.htmlContent).toContain('2026-10-15');
      expect(rendered.htmlContent).toContain('18:00 - 19:00');
      expect(rendered.htmlContent).toContain('3,500');
      expect(rendered.textContent).toContain('SPH-20261002-882311');
    });

    it('should render booking cancellation email with reason', () => {
      const rendered = renderBookingCancellationEmail({
        customerName: 'Ashan Silva',
        bookingReference: 'SPH-20261002-882311',
        venueName: 'Royal Sports Complex',
        facilityName: 'Badminton Court 1',
        bookingDate: '2026-10-15',
        reason: 'Customer schedule conflict',
      });

      expect(rendered.subject).toContain('Booking Cancelled');
      expect(rendered.htmlContent).toContain('SPH-20261002-882311');
      expect(rendered.htmlContent).toContain('Customer schedule conflict');
      expect(rendered.textContent).toContain('Royal Sports Complex');
    });

    it('should render payment success email with transaction reference', () => {
      const rendered = renderPaymentSuccessEmail({
        customerName: 'Kasun Perera',
        transactionReference: 'TXN-998822-PROV',
        bookingReference: 'SPH-20261002-123456',
        amount: 5000,
        currency: 'LKR',
        paymentMethod: 'CARD',
      });

      expect(rendered.subject).toContain('Payment Receipt');
      expect(rendered.htmlContent).toContain('TXN-998822-PROV');
      expect(rendered.htmlContent).toContain('SPH-20261002-123456');
      expect(rendered.htmlContent).toContain('5,000');
      expect(rendered.htmlContent).toContain('CARD');
    });

    it('should render payment failure email with retry guidance', () => {
      const rendered = renderPaymentFailureEmail({
        customerName: 'Kasun Perera',
        bookingReference: 'SPH-20261002-123456',
        amount: 5000,
        currency: 'LKR',
        failureMessage: 'Insufficient funds on card',
      });

      expect(rendered.subject).toContain('Payment Unsuccessful');
      expect(rendered.htmlContent).toContain('Insufficient funds on card');
      expect(rendered.htmlContent).toContain('5,000');
      expect(rendered.textContent).toContain('Please check your card details');
    });

    it('should render refund processed email with refund reference', () => {
      const rendered = renderRefundProcessedEmail({
        customerName: 'Kasun Perera',
        refundReference: 'RFD-112233',
        bookingReference: 'SPH-20261002-123456',
        refundAmount: 5000,
        currency: 'LKR',
        reason: 'Bad weather cancellation',
      });

      expect(rendered.subject).toContain('Refund Processed');
      expect(rendered.htmlContent).toContain('RFD-112233');
      expect(rendered.htmlContent).toContain('5,000');
      expect(rendered.htmlContent).toContain('Bad weather cancellation');
    });

    it('should render hold expiring email with countdown notice', () => {
      const rendered = renderBookingHoldExpiringEmail({
        customerName: 'Nimal Jay',
        bookingReference: 'SPH-20261002-777888',
        facilityName: 'Cricket Turf 01',
        minutesRemaining: 2,
      });

      expect(rendered.subject).toContain('Hold Expiring Soon');
      expect(rendered.htmlContent).toContain('2 Minutes');
      expect(rendered.htmlContent).toContain('Cricket Turf 01');
      expect(rendered.htmlContent).toContain('SPH-20261002-777888');
    });

    it('should never expose sensitive database secrets or server tokens in rendered emails', () => {
      const rendered = renderPaymentSuccessEmail({
        customerName: 'Security Test',
        transactionReference: 'TXN-0001',
        bookingReference: 'SPH-0001',
        amount: 1000,
        currency: 'LKR',
        paymentMethod: 'SANDBOX',
      });

      expect(rendered.htmlContent).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(rendered.htmlContent).not.toContain('DATABASE_URL');
      expect(rendered.htmlContent).not.toContain('JWT_SECRET');
    });
  });

  describe('3. Sandbox Email Provider Tests', () => {
    it('should record sent emails in sandbox outbox', async () => {
      const result = await sandboxEmailProvider.sendEmail({
        to: 'customer@example.com',
        toName: 'Test Customer',
        subject: 'Test Subject',
        htmlContent: '<p>Hello Test</p>',
        textContent: 'Hello Test',
        idempotencyKey: 'test_key_1',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.status).toBe('SENT');

      const outbox = sandboxEmailProvider.getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0].to).toBe('customer@example.com');
      expect(outbox[0].subject).toBe('Test Subject');
    });

    it('should reject invalid recipient email format', async () => {
      const result = await sandboxEmailProvider.sendEmail({
        to: 'invalid-email-string',
        subject: 'Invalid',
        htmlContent: '<p>Invalid</p>',
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('Invalid recipient email');
      expect(sandboxEmailProvider.getOutbox().length).toBe(0);
    });

    it('should simulate network failure when enabled for fault isolation testing', async () => {
      sandboxEmailProvider.setSimulateFailure(true);

      const result = await sandboxEmailProvider.sendEmail({
        to: 'customer@example.com',
        subject: 'Simulated Failure Test',
        htmlContent: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('Simulated network delivery failure');
    });
  });
});
