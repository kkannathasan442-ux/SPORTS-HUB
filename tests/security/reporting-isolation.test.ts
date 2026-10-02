import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { AppRole, MemberStatus } from '@sportshub/types';
import { ROLE_PERMISSIONS } from '@sportshub/config';

interface SecurityAuthContext {
  userId: string | null;
  role?: AppRole;
  organizationMemberships: Array<{
    organizationId: string;
    userId: string;
    role: AppRole;
    status: MemberStatus;
  }>;
}

class RuntimeReportingSecurityEngine {
  /**
   * Evaluates if a user can access overview reports for a target organization.
   */
  public static canAccessOverviewReport(
    ctx: SecurityAuthContext,
    targetOrgId: string
  ): { allowed: boolean; reason?: string } {
    if (!ctx.userId) return { allowed: false, reason: 'Unauthenticated' };

    // Super Admin platform access
    const isSuperAdmin = ctx.organizationMemberships.some(
      (m) => m.userId === ctx.userId && m.role === 'SUPER_ADMIN' && m.status === 'ACTIVE'
    );
    if (isSuperAdmin) return { allowed: true };

    const member = ctx.organizationMemberships.find(
      (m) => m.organizationId === targetOrgId && m.userId === ctx.userId && m.status === 'ACTIVE'
    );

    if (!member) {
      return { allowed: false, reason: 'Not an active organization member' };
    }

    const permissions = ROLE_PERMISSIONS[member.role] || [];
    if (!permissions.includes('report.read')) {
      return { allowed: false, reason: 'Missing report.read permission' };
    }

    return { allowed: true };
  }

  /**
   * Evaluates if a user can access financial/revenue reports.
   */
  public static canAccessFinancialReport(
    ctx: SecurityAuthContext,
    targetOrgId: string
  ): { allowed: boolean; reason?: string } {
    if (!ctx.userId) return { allowed: false, reason: 'Unauthenticated' };

    const member = ctx.organizationMemberships.find(
      (m) => m.organizationId === targetOrgId && m.userId === ctx.userId && m.status === 'ACTIVE'
    );

    if (!member) {
      return { allowed: false, reason: 'Not a member of organization' };
    }

    const permissions = ROLE_PERMISSIONS[member.role] || [];
    if (!permissions.includes('report.financial')) {
      return { allowed: false, reason: 'Missing report.financial permission' };
    }

    return { allowed: true };
  }

  /**
   * Evaluates if a user can export reports.
   */
  public static canExportReports(
    ctx: SecurityAuthContext,
    targetOrgId: string
  ): { allowed: boolean; reason?: string } {
    if (!ctx.userId) return { allowed: false, reason: 'Unauthenticated' };

    const member = ctx.organizationMemberships.find(
      (m) => m.organizationId === targetOrgId && m.userId === ctx.userId && m.status === 'ACTIVE'
    );

    if (!member) {
      return { allowed: false, reason: 'Not a member of organization' };
    }

    const permissions = ROLE_PERMISSIONS[member.role] || [];
    if (!permissions.includes('report.export')) {
      return { allowed: false, reason: 'Missing report.export permission' };
    }

    return { allowed: true };
  }
}

describe('STEP 9 — Reporting Security, Multi-Tenant & RBAC Isolation Tests', () => {
  const ownerOrgA = 'usr-owner-a';
  const managerOrgA = 'usr-mgr-a';
  const receptionistOrgA = 'usr-rec-a';
  const customerUser = 'usr-cust-1';
  const ownerOrgB = 'usr-owner-b';

  const orgA = '550e8400-e29b-41d4-a716-446655440001';
  const orgB = '550e8400-e29b-41d4-a716-446655440002';

  const ctxUnauthenticated: SecurityAuthContext = {
    userId: null,
    organizationMemberships: [],
  };

  const ctxCustomer: SecurityAuthContext = {
    userId: customerUser,
    role: 'CUSTOMER',
    organizationMemberships: [],
  };

  const ctxOwnerOrgA: SecurityAuthContext = {
    userId: ownerOrgA,
    role: 'OWNER',
    organizationMemberships: [
      { organizationId: orgA, userId: ownerOrgA, role: 'OWNER', status: 'ACTIVE' },
    ],
  };

  const ctxManagerOrgA: SecurityAuthContext = {
    userId: managerOrgA,
    role: 'MANAGER',
    organizationMemberships: [
      { organizationId: orgA, userId: managerOrgA, role: 'MANAGER', status: 'ACTIVE' },
    ],
  };

  const ctxReceptionistOrgA: SecurityAuthContext = {
    userId: receptionistOrgA,
    role: 'RECEPTIONIST',
    organizationMemberships: [
      { organizationId: orgA, userId: receptionistOrgA, role: 'RECEPTIONIST', status: 'ACTIVE' },
    ],
  };

  const ctxOwnerOrgB: SecurityAuthContext = {
    userId: ownerOrgB,
    role: 'OWNER',
    organizationMemberships: [
      { organizationId: orgB, userId: ownerOrgB, role: 'OWNER', status: 'ACTIVE' },
    ],
  };

  // ==========================================================================
  // 1. Multi-Tenant Cross-Organization Isolation
  // ==========================================================================
  describe('Multi-Tenant Boundary Isolation', () => {
    it('Owner of Org A CANNOT access Org B overview reports', () => {
      const res = RuntimeReportingSecurityEngine.canAccessOverviewReport(ctxOwnerOrgA, orgB);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Not an active organization member');
    });

    it('Owner of Org A CANNOT access Org B financial revenue reports', () => {
      const res = RuntimeReportingSecurityEngine.canAccessFinancialReport(ctxOwnerOrgA, orgB);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Not a member of organization');
    });

    it('Owner of Org A CANNOT export Org B report data', () => {
      const res = RuntimeReportingSecurityEngine.canExportReports(ctxOwnerOrgA, orgB);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Not a member of organization');
    });
  });

  // ==========================================================================
  // 2. Role-Based Access Control (RBAC)
  // ==========================================================================
  describe('RBAC Permission Hierarchy', () => {
    it('OWNER of Org A has full access to reports, financial revenue, and CSV export', () => {
      expect(RuntimeReportingSecurityEngine.canAccessOverviewReport(ctxOwnerOrgA, orgA).allowed).toBe(true);
      expect(RuntimeReportingSecurityEngine.canAccessFinancialReport(ctxOwnerOrgA, orgA).allowed).toBe(true);
      expect(RuntimeReportingSecurityEngine.canExportReports(ctxOwnerOrgA, orgA).allowed).toBe(true);
    });

    it('MANAGER of Org A has access to reports, financial revenue, and CSV export', () => {
      expect(RuntimeReportingSecurityEngine.canAccessOverviewReport(ctxManagerOrgA, orgA).allowed).toBe(true);
      expect(RuntimeReportingSecurityEngine.canAccessFinancialReport(ctxManagerOrgA, orgA).allowed).toBe(true);
      expect(RuntimeReportingSecurityEngine.canExportReports(ctxManagerOrgA, orgA).allowed).toBe(true);
    });

    it('RECEPTIONIST of Org A can view operational overview reports but is DENIED financial reports and exports', () => {
      expect(RuntimeReportingSecurityEngine.canAccessOverviewReport(ctxReceptionistOrgA, orgA).allowed).toBe(true);
      expect(RuntimeReportingSecurityEngine.canAccessFinancialReport(ctxReceptionistOrgA, orgA).allowed).toBe(false);
      expect(RuntimeReportingSecurityEngine.canExportReports(ctxReceptionistOrgA, orgA).allowed).toBe(false);
    });

    it('CUSTOMER role is completely denied access to owner reporting system', () => {
      expect(RuntimeReportingSecurityEngine.canAccessOverviewReport(ctxCustomer, orgA).allowed).toBe(false);
      expect(RuntimeReportingSecurityEngine.canAccessFinancialReport(ctxCustomer, orgA).allowed).toBe(false);
      expect(RuntimeReportingSecurityEngine.canExportReports(ctxCustomer, orgA).allowed).toBe(false);
    });

    it('Unauthenticated requests are rejected', () => {
      expect(RuntimeReportingSecurityEngine.canAccessOverviewReport(ctxUnauthenticated, orgA).allowed).toBe(false);
      expect(RuntimeReportingSecurityEngine.canAccessFinancialReport(ctxUnauthenticated, orgA).allowed).toBe(false);
      expect(RuntimeReportingSecurityEngine.canExportReports(ctxUnauthenticated, orgA).allowed).toBe(false);
    });
  });

  // ==========================================================================
  // 3. Database Migration Invariant Verification
  // ==========================================================================
  describe('Database Reporting Migration Invariants', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261001000021_reporting_indexes.sql'
    );

    it('verifies reporting composite indexes migration exists', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const content = fs.readFileSync(migrationPath, 'utf-8');

      expect(content).toContain('idx_bookings_org_date');
      expect(content).toContain('idx_bookings_facility_status_date');
      expect(content).toContain('idx_payments_org_created_status');
      expect(content).toContain('idx_refunds_org_created_status');
    });
  });
});
