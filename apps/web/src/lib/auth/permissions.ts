/**
 * SportsHub RBAC Permission Utilities
 *
 * Provides functions to query and evaluate role permissions.
 */

import { ROLE_PERMISSIONS } from '@sportshub/config';
import type { AppRole, Permission } from '@sportshub/types';

/**
 * Returns the list of permissions granted to a given application role.
 */
export function getRolePermissions(role: AppRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Evaluates whether a role possesses a specific permission.
 */
export function hasPermission(role: AppRole, permission: Permission): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

/**
 * Evaluates whether a role possesses ALL of the required permissions.
 */
export function hasAllPermissions(role: AppRole, permissions: Permission[]): boolean {
  const granted = getRolePermissions(role);
  return permissions.every((perm) => granted.includes(perm));
}

/**
 * Evaluates whether a role possesses AT LEAST ONE of the specified permissions.
 */
export function hasAnyPermission(role: AppRole, permissions: Permission[]): boolean {
  const granted = getRolePermissions(role);
  return permissions.some((perm) => granted.includes(perm));
}
