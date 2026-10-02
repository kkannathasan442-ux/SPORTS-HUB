/**
 * SportsHub Current User & Session Utilities
 *
 * Provides safe server-side access to authenticated user identity, profile, and active organization context.
 */

import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '../supabase/server';
import { getActiveMemberships, getUserMemberships } from './membership';
import { getRolePermissions } from './permissions';
import type {
  AuthUser,
  Profile,
  Organization,
  OrganizationMember,
  ActiveOrganizationContext,
} from '@sportshub/types';

export const ACTIVE_ORG_COOKIE_NAME = 'sportshub_active_org_id';

/**
 * Retrieves the currently authenticated Supabase user from the session cookie.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || '',
    phone: user.phone || null,
    user_metadata: user.user_metadata,
  };
}

/**
 * Retrieves the application profile for the currently authenticated user.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  return profile as Profile;
}

/**
 * Retrieves the active organization ID selected in the user's cookies.
 */
export async function getActiveOrganizationId(): Promise<string | null> {
  const cookieStore = cookies();
  const cookieVal = cookieStore.get(ACTIVE_ORG_COOKIE_NAME)?.value;
  return cookieVal || null;
}

/**
 * Resolves the full active organization security context for the current user.
 *
 * Enforces server verification:
 * - Ensures user is authenticated
 * - Ensures user has an ACTIVE membership in the requested organization
 * - If requested org is invalid or unauthorized, falls back safely to their first active organization
 * - Never trusts client cookies or headers blindly
 */
export async function getActiveOrganizationContext(): Promise<ActiveOrganizationContext | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return null;
  }

  const allMemberships = await getUserMemberships(user.id);
  const activeMemberships = allMemberships.filter((m) => m.status === 'ACTIVE');

  const requestedOrgId = await getActiveOrganizationId();

  // Find membership matching cookie if present and active
  let activeMembership: OrganizationMember | null = null;
  if (requestedOrgId) {
    activeMembership = activeMemberships.find((m) => m.organization_id === requestedOrgId) || null;
  }

  // Fallback to first active membership if requested org not found or not active
  if (!activeMembership && activeMemberships.length > 0) {
    activeMembership = activeMemberships[0];
  }

  let activeOrganization: Organization | null = null;
  if (activeMembership) {
    const supabase = await createSupabaseServerClient();
    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', activeMembership.organization_id)
      .maybeSingle();

    if (org) {
      activeOrganization = org as Organization;
    }
  }

  const role = activeMembership ? activeMembership.role : null;
  const permissions = role ? getRolePermissions(role) : [];

  return {
    user,
    profile,
    activeOrganization,
    activeMembership,
    allMemberships,
    role,
    permissions,
  };
}
