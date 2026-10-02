import { describe, it, expect } from 'vitest';
import {
  bookingOperationalSettingsSchema,
  paymentOperationalSettingsSchema,
  notificationOperationalSettingsSchema,
  organizationOperationalSettingsSchema,
  updateOrganizationSettingsSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
  auditLogFilterSchema,
} from '@sportshub/validation';
import { sanitizeAuditData } from '../../apps/web/src/lib/audit/audit-service';

describe('STEP 10 — Settings, Members & Audit Engine Unit Tests', () => {
  describe('Organization Operational Settings Schemas & Defaults', () => {
    it('should validate and supply default booking operational settings', () => {
      const parsed = bookingOperationalSettingsSchema.parse({});
      expect(parsed.min_booking_duration_minutes).toBe(30);
      expect(parsed.max_booking_duration_minutes).toBe(480);
      expect(parsed.hold_duration_minutes).toBe(10);
      expect(parsed.cancellation_window_hours).toBe(2);
      expect(parsed.buffer_minutes).toBe(0);
      expect(parsed.allow_auto_confirm).toBe(true);
    });

    it('should reject invalid booking operational settings', () => {
      // hold duration < 1 or > 60
      expect(() =>
        bookingOperationalSettingsSchema.parse({ hold_duration_minutes: 0 })
      ).toThrow();
      expect(() =>
        bookingOperationalSettingsSchema.parse({ hold_duration_minutes: 120 })
      ).toThrow();

      // negative buffer or negative cancellation
      expect(() =>
        bookingOperationalSettingsSchema.parse({ cancellation_window_hours: -1 })
      ).toThrow();
    });

    it('should validate payment operational settings and preserve safe payment methods', () => {
      const parsed = paymentOperationalSettingsSchema.parse({
        enabled_methods: ['SANDBOX', 'STRIPE', 'PAYHERE', 'CASH'],
        allow_offline_payments: true,
        offline_payment_instructions: 'Pay at reception desk',
        tax_registration_number: 'VAT-987654',
      });

      expect(parsed.enabled_methods).toHaveLength(4);
      expect(parsed.allow_offline_payments).toBe(true);
      expect(parsed.tax_registration_number).toBe('VAT-987654');
    });

    it('should validate notification operational settings', () => {
      const parsed = notificationOperationalSettingsSchema.parse({
        email_enabled: true,
        sms_enabled: false,
        booking_confirmation_enabled: true,
        hold_reminder_enabled: true,
        marketing_consent_required: true,
      });

      expect(parsed.email_enabled).toBe(true);
      expect(parsed.sms_enabled).toBe(false);
      expect(parsed.hold_reminder_enabled).toBe(true);
    });

    it('should validate full organization settings schema update payload', () => {
      const payload = {
        name: 'Royal Sports Arena Colombo',
        description: 'Premier indoor and outdoor multisport facility.',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        settings: {
          booking: {
            min_booking_duration_minutes: 60,
            max_booking_duration_minutes: 360,
            hold_duration_minutes: 15,
            cancellation_window_hours: 4,
            buffer_minutes: 5,
            allow_auto_confirm: true,
          },
        },
      };

      const parsed = updateOrganizationSettingsSchema.parse(payload);
      expect(parsed.name).toBe('Royal Sports Arena Colombo');
      expect(parsed.settings?.booking.hold_duration_minutes).toBe(15);
      expect(parsed.settings?.booking.cancellation_window_hours).toBe(4);
    });
  });

  describe('Member Management Schemas & Constraints', () => {
    it('should validate valid staff member invitations', () => {
      const validRoles = ['MANAGER', 'RECEPTIONIST', 'SCORER', 'COACH'] as const;

      for (const role of validRoles) {
        const parsed = inviteMemberSchema.parse({
          email: `test.${role.toLowerCase()}@sportshub.local`,
          role,
          fullName: `Test ${role}`,
        });
        expect(parsed.role).toBe(role);
      }
    });

    it('should reject assigning SUPER_ADMIN or OWNER through member invite endpoint', () => {
      expect(() =>
        inviteMemberSchema.parse({
          email: 'admin@hack.local',
          role: 'SUPER_ADMIN' as any,
        })
      ).toThrow();

      expect(() =>
        inviteMemberSchema.parse({
          email: 'owner@hack.local',
          role: 'OWNER' as any,
        })
      ).toThrow();
    });

    it('should reject invalid email formats in invitations', () => {
      expect(() =>
        inviteMemberSchema.parse({
          email: 'not-an-email',
          role: 'MANAGER',
        })
      ).toThrow();
    });

    it('should validate member role and status updates', () => {
      const roleUpdate = updateMemberRoleSchema.parse({ role: 'RECEPTIONIST' });
      expect(roleUpdate.role).toBe('RECEPTIONIST');

      const statusUpdate = updateMemberStatusSchema.parse({ status: 'SUSPENDED' });
      expect(statusUpdate.status).toBe('SUSPENDED');
    });
  });

  describe('Audit Log Sanitization & Filter Engine', () => {
    it('should strip sensitive keys (passwords, tokens, secret keys, credit card numbers) from audit logs', () => {
      const rawData = {
        name: 'SportsHub Club',
        password: 'super-secret-password-123',
        api_key: 'sk_live_1234567890abcdef',
        secret_key: 'sec_private_abc',
        card_number: '4111222233334444',
        cvv: '123',
        nested: {
          token: 'jwt.token.here',
          authorization: 'Bearer 9999',
          allowedField: 'safeValue',
        },
      };

      const sanitized = sanitizeAuditData(rawData);

      expect(sanitized.name).toBe('SportsHub Club');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.secret_key).toBe('[REDACTED]');
      expect(sanitized.card_number).toBe('[REDACTED]');
      expect(sanitized.cvv).toBe('[REDACTED]');
      expect(sanitized.nested.token).toBe('[REDACTED]');
      expect(sanitized.nested.authorization).toBe('[REDACTED]');
      expect(sanitized.nested.allowedField).toBe('safeValue');
    });

    it('should validate audit log query filters and pagination defaults', () => {
      const parsed = auditLogFilterSchema.parse({
        action: 'MEMBER_INVITED',
        entityType: 'organization_members',
        page: 2,
        limit: 50,
      });

      expect(parsed.action).toBe('MEMBER_INVITED');
      expect(parsed.entityType).toBe('organization_members');
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
    });
  });
});
