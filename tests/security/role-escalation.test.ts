import { describe, it, expect } from 'vitest';
import { hasPermission } from '../../apps/web/src/lib/auth/permissions';
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
} from '@sportshub/validation';
import type { AppRole } from '@sportshub/types';

describe('STEP 10 — Role Escalation & Privilege Boundary Security Tests', () => {
  describe('Staff Management RBAC Constraints', () => {
    it('should grant staff.manage to SUPER_ADMIN and OWNER only', () => {
      expect(hasPermission('SUPER_ADMIN', 'staff.manage')).toBe(true);
      expect(hasPermission('OWNER', 'staff.manage')).toBe(true);

      // Invariant: MANAGER, RECEPTIONIST, SCORER, COACH, CUSTOMER CANNOT manage staff
      expect(hasPermission('MANAGER', 'staff.manage')).toBe(false);
      expect(hasPermission('RECEPTIONIST', 'staff.manage')).toBe(false);
      expect(hasPermission('SCORER', 'staff.manage')).toBe(false);
      expect(hasPermission('COACH', 'staff.manage')).toBe(false);
      expect(hasPermission('CUSTOMER', 'staff.manage')).toBe(false);
      expect(hasPermission('PLAYER', 'staff.manage')).toBe(false);
    });

    it('should allow staff.read to SUPER_ADMIN, OWNER, and MANAGER only', () => {
      expect(hasPermission('SUPER_ADMIN', 'staff.read')).toBe(true);
      expect(hasPermission('OWNER', 'staff.read')).toBe(true);
      expect(hasPermission('MANAGER', 'staff.read')).toBe(true);

      expect(hasPermission('RECEPTIONIST', 'staff.read')).toBe(false);
      expect(hasPermission('CUSTOMER', 'staff.read')).toBe(false);
    });
  });

  describe('Role Escalation Prevention Rules', () => {
    it('should forbid assigning SUPER_ADMIN or OWNER through member invitation schema', () => {
      expect(() =>
        inviteMemberSchema.parse({
          email: 'attacker@evil.com',
          role: 'SUPER_ADMIN' as any,
        })
      ).toThrow();

      expect(() =>
        inviteMemberSchema.parse({
          email: 'attacker@evil.com',
          role: 'OWNER' as any,
        })
      ).toThrow();
    });

    it('should forbid elevating existing members to SUPER_ADMIN or OWNER through role update schema', () => {
      expect(() =>
        updateMemberRoleSchema.parse({
          role: 'SUPER_ADMIN' as any,
        })
      ).toThrow();

      expect(() =>
        updateMemberRoleSchema.parse({
          role: 'OWNER' as any,
        })
      ).toThrow();
    });

    it('should accept only valid assignable staff roles', () => {
      const allowedRoles: AppRole[] = ['MANAGER', 'RECEPTIONIST', 'SCORER', 'COACH'];

      for (const role of allowedRoles) {
        const parsed = updateMemberRoleSchema.parse({ role });
        expect(parsed.role).toBe(role);
      }
    });

    it('should reject invalid status transitions or arbitrary strings', () => {
      expect(() =>
        updateMemberStatusSchema.parse({
          status: 'SUPER_ACTIVE' as any,
        })
      ).toThrow();
    });
  });
});
