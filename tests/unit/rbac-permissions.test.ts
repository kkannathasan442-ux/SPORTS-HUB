import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '@sportshub/config';
import {
  getRolePermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from '../../apps/web/src/lib/auth/permissions';
import type { AppRole, Permission } from '@sportshub/types';

describe('RBAC Permissions & Role Mapping — STEP 3', () => {
  const allRoles: AppRole[] = [
    'SUPER_ADMIN',
    'OWNER',
    'MANAGER',
    'RECEPTIONIST',
    'SCORER',
    'COACH',
    'CUSTOMER',
    'PLAYER',
  ];

  it('should define permission mappings for all 8 application roles', () => {
    for (const role of allRoles) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  describe('Super Admin Role Permissions', () => {
    it('should grant platform-wide read and manage permissions to SUPER_ADMIN', () => {
      expect(hasPermission('SUPER_ADMIN', 'platform.read')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'platform.manage')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'organization.manage')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'venue.manage')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'facility.manage')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'staff.manage')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'customer.manage')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'scoring.manage')).toBe(true);
    });

    it('should confirm SUPER_ADMIN holds all possible permissions', () => {
      const allPermissions: Permission[] = [
        'platform.read',
        'platform.manage',
        'organization.read',
        'organization.manage',
        'venue.read',
        'venue.manage',
        'facility.read',
        'facility.manage',
        'staff.read',
        'staff.manage',
        'customer.read',
        'customer.manage',
        'scoring.read',
        'scoring.manage',
        'booking.read',
        'booking.manage',
        'booking.create',
        'booking.cancel',
        'payment.read',
        'payment.create',
        'payment.refund',
        'payment.manage',
        'notification.read',
        'notification.manage',
        'report.read',
        'report.financial',
        'report.export',
        'audit.read',
        'audit.manage',
        'settings.read',
        'settings.manage',
      ];

      expect(hasAllPermissions('SUPER_ADMIN', allPermissions)).toBe(true);
    });
  });

  describe('Tenant Owner Role Permissions', () => {
    it('should grant organization, settings, audit, and venue management to OWNER, but NOT platform management', () => {
      expect(hasPermission('OWNER', 'organization.manage')).toBe(true);
      expect(hasPermission('OWNER', 'settings.manage')).toBe(true);
      expect(hasPermission('OWNER', 'audit.read')).toBe(true);
      expect(hasPermission('OWNER', 'venue.manage')).toBe(true);
      expect(hasPermission('OWNER', 'facility.manage')).toBe(true);
      expect(hasPermission('OWNER', 'staff.manage')).toBe(true);
      expect(hasPermission('OWNER', 'customer.manage')).toBe(true);
      expect(hasPermission('OWNER', 'scoring.manage')).toBe(true);
      expect(hasPermission('OWNER', 'notification.manage')).toBe(true);

      // Invariant: Tenant Owner cannot manage the global platform
      expect(hasPermission('OWNER', 'platform.read')).toBe(false);
      expect(hasPermission('OWNER', 'platform.manage')).toBe(false);
    });
  });

  describe('Manager Role Permissions', () => {
    it('should allow venue, facility, customer management but NOT staff management or org deletion', () => {
      expect(hasPermission('MANAGER', 'organization.read')).toBe(true);
      expect(hasPermission('MANAGER', 'organization.manage')).toBe(false); // Only OWNER/SUPER_ADMIN can manage org entity
      expect(hasPermission('MANAGER', 'venue.manage')).toBe(true);
      expect(hasPermission('MANAGER', 'facility.manage')).toBe(true);
      expect(hasPermission('MANAGER', 'staff.read')).toBe(true);
      expect(hasPermission('MANAGER', 'staff.manage')).toBe(false); // Only OWNER/SUPER_ADMIN can manage staff roles
      expect(hasPermission('MANAGER', 'customer.manage')).toBe(true);
      expect(hasPermission('MANAGER', 'scoring.read')).toBe(true);
      expect(hasPermission('MANAGER', 'notification.read')).toBe(true);
    });
  });

  describe('Receptionist & Scorer & Coach Role Permissions', () => {
    it('should enforce restricted access for RECEPTIONIST', () => {
      expect(hasPermission('RECEPTIONIST', 'organization.read')).toBe(true);
      expect(hasPermission('RECEPTIONIST', 'venue.read')).toBe(true);
      expect(hasPermission('RECEPTIONIST', 'facility.read')).toBe(true);
      expect(hasPermission('RECEPTIONIST', 'customer.read')).toBe(true);
      expect(hasPermission('RECEPTIONIST', 'customer.manage')).toBe(true);
      expect(hasPermission('RECEPTIONIST', 'notification.read')).toBe(true);

      expect(hasPermission('RECEPTIONIST', 'venue.manage')).toBe(false);
      expect(hasPermission('RECEPTIONIST', 'staff.manage')).toBe(false);
      expect(hasPermission('RECEPTIONIST', 'scoring.manage')).toBe(false);
    });

    it('should enforce scoring-specific access for SCORER', () => {
      expect(hasPermission('SCORER', 'scoring.read')).toBe(true);
      expect(hasPermission('SCORER', 'scoring.manage')).toBe(true);
      expect(hasPermission('SCORER', 'venue.read')).toBe(true);

      expect(hasPermission('SCORER', 'venue.manage')).toBe(false);
      expect(hasPermission('SCORER', 'staff.manage')).toBe(false);
      expect(hasPermission('SCORER', 'customer.manage')).toBe(false);
    });

    it('should enforce training-specific access for COACH', () => {
      expect(hasPermission('COACH', 'customer.read')).toBe(true);
      expect(hasPermission('COACH', 'customer.manage')).toBe(true);
      expect(hasPermission('COACH', 'venue.read')).toBe(true);

      expect(hasPermission('COACH', 'venue.manage')).toBe(false);
      expect(hasPermission('COACH', 'staff.manage')).toBe(false);
      expect(hasPermission('COACH', 'scoring.manage')).toBe(false);
    });
  });

  describe('Customer and Player Permissions', () => {
    it('should grant expected permissions to CUSTOMER and PLAYER', () => {
      expect(getRolePermissions('CUSTOMER')).toEqual([
        'customer.read',
        'booking.read',
        'booking.create',
        'booking.cancel',
        'payment.read',
        'payment.create',
        'notification.read',
      ]);
      expect(getRolePermissions('PLAYER')).toEqual(['customer.read', 'booking.read']);

      expect(hasPermission('CUSTOMER', 'venue.manage')).toBe(false);
      expect(hasPermission('CUSTOMER', 'facility.manage')).toBe(false);
      expect(hasPermission('CUSTOMER', 'staff.manage')).toBe(false);
      expect(hasPermission('CUSTOMER', 'organization.manage')).toBe(false);
      expect(hasPermission('CUSTOMER', 'platform.manage')).toBe(false);
    });
  });

  describe('Permission Helper Utilities', () => {
    it('should verify hasAnyPermission returns true if any requested permission is held', () => {
      expect(hasAnyPermission('RECEPTIONIST', ['venue.manage', 'customer.manage'])).toBe(true);
      expect(hasAnyPermission('CUSTOMER', ['venue.manage', 'staff.manage'])).toBe(false);
    });

    it('should verify hasAllPermissions returns true only when all permissions are held', () => {
      expect(hasAllPermissions('MANAGER', ['organization.read', 'venue.manage'])).toBe(true);
      expect(hasAllPermissions('MANAGER', ['organization.read', 'organization.manage'])).toBe(false);
    });
  });
});
