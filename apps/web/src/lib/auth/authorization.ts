/**
 * SportsHub Server-Side Authorization Guard Utilities
 *
 * Enforces authentication, tenant membership, role-based access, and permissions.
 */

import { getCurrentProfile, getCurrentUser } from './current-user';
import { getOrganizationMembership, isSuperAdmin } from './membership';
import { hasPermission } from './permissions';
import {
  UnauthorizedError,
  ForbiddenError,
  TenantIsolationError,
} from './errors';
import type {
  AuthUser,
  Profile,
  OrganizationMember,
  AppRole,
  Permission,
} from '@sportshub/types';

export interface AuthorizedAuthContext {
  user: AuthUser;
  profile: Profile;
}

export interface AuthorizedOrgContext extends AuthorizedAuthContext {
  membership: OrganizationMember | null;
  isSuperAdmin: boolean;
}

/**
 * Enforces that the incoming request is authenticated.
 * Throws UnauthorizedError if no valid session is found.
 */
export async function requireAuth(): Promise<AuthorizedAuthContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError('Authentication required. Please sign in.');
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new UnauthorizedError('User profile not found.');
  }

  return { user, profile };
}

/**
 * Enforces that the authenticated user is an ACTIVE member of the target organization
 * or holds a platform SUPER_ADMIN role.
 */
export async function requireOrganizationMember(
  organizationId: string
): Promise<AuthorizedOrgContext> {
  const { user, profile } = await requireAuth();

  const superAdmin = await isSuperAdmin(user.id);
  if (superAdmin) {
    return { user, profile, membership: null, isSuperAdmin: true };
  }

  const membership = await getOrganizationMembership(user.id, organizationId);
  if (!membership || membership.status !== 'ACTIVE') {
    throw new TenantIsolationError(
      'You are not authorized to access this organization.'
    );
  }

  return { user, profile, membership, isSuperAdmin: false };
}

/**
 * Enforces that the user has one of the allowed roles within the organization
 * (or is a platform SUPER_ADMIN).
 */
export async function requireOrganizationRole(
  organizationId: string,
  allowedRoles: AppRole[]
): Promise<AuthorizedOrgContext> {
  const context = await requireOrganizationMember(organizationId);

  if (context.isSuperAdmin) {
    return context;
  }

  if (!context.membership || !allowedRoles.includes(context.membership.role)) {
    throw new ForbiddenError(
      'You do not have the required role to perform this action.'
    );
  }

  return context;
}

/**
 * Enforces that the user has a specific permission in the target organization.
 */
export async function requirePermission(
  organizationId: string,
  permission: Permission
): Promise<AuthorizedOrgContext> {
  const context = await requireOrganizationMember(organizationId);

  if (context.isSuperAdmin) {
    return context;
  }

  if (!context.membership || !hasPermission(context.membership.role, permission)) {
    throw new ForbiddenError(
      `Permission denied: Requires '${permission}'.`
    );
  }

  return context;
}

/**
 * Enforces that the authenticated user is a platform SUPER_ADMIN.
 */
export async function requireSuperAdmin(): Promise<AuthorizedAuthContext> {
  const { user, profile } = await requireAuth();

  const superAdmin = await isSuperAdmin(user.id);
  if (!superAdmin) {
    throw new ForbiddenError(
      'Platform administrator access required.'
    );
  }

  return { user, profile };
}
