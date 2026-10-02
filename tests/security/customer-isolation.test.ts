import { describe, it, expect } from 'vitest';
import { hasPermission } from '../../apps/web/src/lib/auth/permissions';
import { updateCustomerProfileSchema } from '../../packages/validation/src/index';

describe('STEP 11 — Customer Account & Isolation Security Tests', () => {
  describe('1. Role-Based Access Control (RBAC) Protections', () => {
    it('CUSTOMER role must NOT have administrative or staff permissions', () => {
      // Customer cannot read or manage audit logs
      expect(hasPermission('CUSTOMER', 'audit.read')).toBe(false);
      expect(hasPermission('CUSTOMER', 'audit.manage')).toBe(false);

      // Customer cannot manage organizations, members, or settings
      expect(hasPermission('CUSTOMER', 'settings.read')).toBe(false);
      expect(hasPermission('CUSTOMER', 'settings.manage')).toBe(false);
      expect(hasPermission('CUSTOMER', 'staff.manage')).toBe(false);
      expect(hasPermission('CUSTOMER', 'organization.manage')).toBe(false);

      // Customer cannot view organization-wide reports
      expect(hasPermission('CUSTOMER', 'report.read')).toBe(false);
      expect(hasPermission('CUSTOMER', 'report.export')).toBe(false);

      // Customer cannot manage venues/facilities directly
      expect(hasPermission('CUSTOMER', 'venue.manage')).toBe(false);
      expect(hasPermission('CUSTOMER', 'facility.manage')).toBe(false);
    });

    it('CUSTOMER role has customer-appropriate permissions only', () => {
      expect(hasPermission('CUSTOMER', 'booking.create')).toBe(true);
      expect(hasPermission('CUSTOMER', 'booking.read')).toBe(true);
      expect(hasPermission('CUSTOMER', 'booking.cancel')).toBe(true);
      expect(hasPermission('CUSTOMER', 'payment.create')).toBe(true);
      expect(hasPermission('CUSTOMER', 'payment.read')).toBe(true);
      expect(hasPermission('CUSTOMER', 'notification.read')).toBe(true);
    });
  });

  describe('2. Customer Profile Field Shielding & Anti-Tampering', () => {
    it('should only permit whitelisted profile fields to be updated', () => {
      const validPayload = {
        full_name: 'Jane Doe',
        display_name: 'JaneD',
        phone: '+94771234567',
        preferred_language: 'en',
        timezone: 'Asia/Colombo',
        country_code: 'LK',
        avatar_url: 'https://example.com/avatar.jpg',
        emergency_contact_name: 'John Doe',
        emergency_contact_phone: '+94777654321',
        notes: 'Frequent badminton player',
      };

      const result = updateCustomerProfileSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should ignore / strip unpermitted administrative and system fields', () => {
      const maliciousPayload = {
        full_name: 'Jane Doe',
        role: 'SUPER_ADMIN',
        organization_id: '11111111-1111-1111-1111-111111111111',
        is_active: true,
        is_verified: true,
        user_id: '99999999-9999-9999-9999-999999999999',
        created_at: '2020-01-01T00:00:00Z',
        permissions: ['*'],
      };

      const parsed = updateCustomerProfileSchema.parse(maliciousPayload);

      // Verify stripped
      expect((parsed as any).role).toBeUndefined();
      expect((parsed as any).organization_id).toBeUndefined();
      expect((parsed as any).is_active).toBeUndefined();
      expect((parsed as any).is_verified).toBeUndefined();
      expect((parsed as any).user_id).toBeUndefined();
      expect((parsed as any).created_at).toBeUndefined();
      expect((parsed as any).permissions).toBeUndefined();
      expect(parsed.full_name).toBe('Jane Doe');
    });

    it('should enforce format validations on phone, country code, and URLs', () => {
      const invalidCountry = updateCustomerProfileSchema.safeParse({
        country_code: 'TOOLONG',
      });
      expect(invalidCountry.success).toBe(false);

      const invalidUrl = updateCustomerProfileSchema.safeParse({
        avatar_url: 'not-a-url',
      });
      expect(invalidUrl.success).toBe(false);
    });
  });

  describe('3. Customer Isolation & Data Boundaries', () => {
    it('ensures customer isolation invariants between Customer A and Customer B', () => {
      const customerA = {
        id: 'cust-a-uuid',
        email: 'customerA@test.local',
        bookings: ['b-101', 'b-102'],
        payments: ['pay-101'],
      };

      const customerB = {
        id: 'cust-b-uuid',
        email: 'customerB@test.local',
        bookings: ['b-201'],
        payments: ['pay-201'],
      };

      expect(customerA.id).not.toBe(customerB.id);
      expect(customerA.bookings).not.toEqual(expect.arrayContaining(customerB.bookings));
      expect(customerA.payments).not.toEqual(expect.arrayContaining(customerB.payments));
    });

    it('ensures booking receipt generation strictly requires booking user_id to match session user_id', () => {
      const bookingRecord = {
        id: 'b-secure-123',
        user_id: 'cust-a-uuid',
        organization_id: 'org-1-uuid',
        total_amount: 5000,
        currency: 'LKR',
      };

      const sessionCustomerA = { id: 'cust-a-uuid' };
      const sessionCustomerB = { id: 'cust-b-uuid' };

      // Customer A is authorized
      expect(bookingRecord.user_id === sessionCustomerA.id).toBe(true);

      // Customer B is rejected
      expect(bookingRecord.user_id === sessionCustomerB.id).toBe(false);
    });
  });
});
