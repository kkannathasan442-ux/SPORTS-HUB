/**
 * SportsHub Organization Membership Queries
 *
 * Server-side helpers for querying user organization memberships and roles.
 */

import { createSupabaseServerClient } from '../supabase/server';
import type { OrganizationMember, Organization } from '@sportshub/types';

/**
 * Retrieves all memberships for a user across all organizations.
 */
export async function getUserMemberships(userId: string): Promise<OrganizationMember[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('user_id', userId);

  if (error || !data) {
    return [];
  }

  return data as OrganizationMember[];
}

/**
 * Retrieves only ACTIVE memberships for a user.
 */
export async function getActiveMemberships(userId: string): Promise<OrganizationMember[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (error || !data) {
    return [];
  }

  return data as OrganizationMember[];
}

/**
 * Retrieves a specific user membership for a designated organization.
 */
export async function getOrganizationMembership(
  userId: string,
  organizationId: string
): Promise<OrganizationMember | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as OrganizationMember;
}

/**
 * Retrieves organizations where the user holds an ACTIVE membership.
 */
export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const supabase = await createSupabaseServerClient();

  const { data: memberRows, error: memberErr } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (memberErr || !memberRows || memberRows.length === 0) {
    return [];
  }

  const orgIds = memberRows.map((m) => m.organization_id);

  const { data: orgs, error: orgsErr } = await supabase
    .from('organizations')
    .select('*')
    .in('id', orgIds);

  if (orgsErr || !orgs) {
    return [];
  }

  return orgs as Organization[];
}

/**
 * Checks if the user holds a platform SUPER_ADMIN role with ACTIVE status.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'SUPER_ADMIN')
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}
