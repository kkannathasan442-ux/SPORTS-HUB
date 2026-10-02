/**
 * SportsHub Organization Member Management Service — STEP 10
 *
 * Provides strictly authorized member queries, invites, role updates, and status changes.
 * Enforces role boundaries, self-escalation blocks, and automatic audit logging.
 */

import { createSupabaseServerClient } from '../supabase/server';
import { createAuditLog } from '../audit/audit-service';
import type {
  AppRole,
  MemberStatus,
  OrganizationMemberWithProfile,
} from '@sportshub/types';

const PERMITTED_ASSIGNABLE_ROLES: AppRole[] = [
  'MANAGER',
  'RECEPTIONIST',
  'SCORER',
  'COACH',
];

export interface InviteMemberInput {
  email: string;
  role: AppRole;
  fullName?: string;
}

/**
 * Fetch all members of an organization with profile info
 */
export async function fetchOrganizationMembers(
  organizationId: string
): Promise<OrganizationMemberWithProfile[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('organization_members')
    .select(
      `
      id,
      organization_id,
      user_id,
      role,
      status,
      joined_at,
      created_at,
      updated_at,
      profile:profiles!user_id(id, email, full_name, avatar_url, phone)
    `
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching organization members:', error);
    return [];
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    organization_id: m.organization_id,
    user_id: m.user_id,
    role: m.role,
    status: m.status,
    joined_at: m.joined_at,
    created_at: m.created_at,
    updated_at: m.updated_at,
    profile: m.profile || {
      id: m.user_id,
      email: 'unknown@sportshub.local',
      full_name: 'Team Member',
      avatar_url: null,
      phone: null,
    },
  }));
}

/**
 * Invite or add a new team member to an organization
 */
export async function inviteOrAddMember(
  organizationId: string,
  actorUserId: string,
  input: InviteMemberInput
): Promise<{ success: boolean; member?: OrganizationMemberWithProfile; error?: string }> {
  if (!PERMITTED_ASSIGNABLE_ROLES.includes(input.role)) {
    return {
      success: false,
      error: `Role '${input.role}' cannot be assigned. Permitted roles: ${PERMITTED_ASSIGNABLE_ROLES.join(', ')}.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const normalizedEmail = input.email.trim().toLowerCase();

  // Check if profile exists with this email
  let { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, phone')
    .eq('email', normalizedEmail)
    .maybeSingle();

  // If profile doesn't exist, create an invited profile placeholder
  if (!profile) {
    const { data: newProfile, error: profileErr } = await supabase
      .from('profiles')
      .insert({
        email: normalizedEmail,
        full_name: input.fullName?.trim() || normalizedEmail.split('@')[0],
      })
      .select('id, email, full_name, avatar_url, phone')
      .single();

    if (profileErr || !newProfile) {
      return { success: false, error: 'Failed to create user profile for invitation.' };
    }
    profile = newProfile;
  }

  // Check if already an organization member
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id, role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (existingMember) {
    return {
      success: false,
      error: `User with email ${normalizedEmail} is already a member (${existingMember.role}, ${existingMember.status}).`,
    };
  }

  // Insert organization membership
  const { data: membership, error: memberErr } = await supabase
    .from('organization_members')
    .insert({
      organization_id: organizationId,
      user_id: profile.id,
      role: input.role,
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (memberErr || !membership) {
    return { success: false, error: memberErr?.message || 'Failed to add organization member.' };
  }

  const resultMember: OrganizationMemberWithProfile = {
    id: membership.id,
    organization_id: membership.organization_id,
    user_id: membership.user_id,
    role: membership.role,
    status: membership.status,
    joined_at: membership.joined_at,
    created_at: membership.created_at,
    updated_at: membership.updated_at,
    profile,
  };

  // Record audit log
  await createAuditLog({
    organizationId,
    actorUserId,
    action: 'MEMBER_INVITED',
    entityType: 'organization_members',
    entityId: membership.id,
    afterData: {
      userId: profile.id,
      email: profile.email,
      role: input.role,
      status: 'ACTIVE',
    },
    metadata: {
      invitedEmail: normalizedEmail,
      assignedRole: input.role,
    },
  });

  return { success: true, member: resultMember };
}

/**
 * Update the role of an organization member
 */
export async function updateMemberRole(
  organizationId: string,
  actorUserId: string,
  memberId: string,
  newRole: AppRole
): Promise<{ success: boolean; member?: OrganizationMemberWithProfile; error?: string }> {
  if (!PERMITTED_ASSIGNABLE_ROLES.includes(newRole)) {
    return {
      success: false,
      error: `Role '${newRole}' cannot be assigned. Permitted roles: ${PERMITTED_ASSIGNABLE_ROLES.join(', ')}.`,
    };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch target member
  const { data: targetMember, error: fetchErr } = await supabase
    .from('organization_members')
    .select('*, profile:profiles!user_id(id, email, full_name, avatar_url, phone)')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .single();

  if (fetchErr || !targetMember) {
    return { success: false, error: 'Member not found in this organization.' };
  }

  // Self-role modification check
  if (targetMember.user_id === actorUserId) {
    return { success: false, error: 'You cannot modify your own role.' };
  }

  // Prevent modifying SUPER_ADMIN or OWNER through staff role update
  if (targetMember.role === 'SUPER_ADMIN' || targetMember.role === 'OWNER') {
    return { success: false, error: 'Cannot modify the role of an Owner or Super Admin.' };
  }

  const beforeData = {
    role: targetMember.role,
    status: targetMember.status,
  };

  const { data: updatedMember, error: updateErr } = await supabase
    .from('organization_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .select('*, profile:profiles!user_id(id, email, full_name, avatar_url, phone)')
    .single();

  if (updateErr || !updatedMember) {
    return { success: false, error: updateErr?.message || 'Failed to update member role.' };
  }

  // Record audit log
  await createAuditLog({
    organizationId,
    actorUserId,
    action: 'MEMBER_ROLE_UPDATED',
    entityType: 'organization_members',
    entityId: memberId,
    beforeData,
    afterData: {
      role: newRole,
      status: updatedMember.status,
    },
    metadata: {
      targetUserId: targetMember.user_id,
      targetEmail: targetMember.profile?.email,
      previousRole: targetMember.role,
      newRole,
    },
  });

  return { success: true, member: updatedMember as OrganizationMemberWithProfile };
}

/**
 * Update member status (ACTIVE, SUSPENDED, REMOVED)
 */
export async function updateMemberStatus(
  organizationId: string,
  actorUserId: string,
  memberId: string,
  newStatus: MemberStatus
): Promise<{ success: boolean; member?: OrganizationMemberWithProfile; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: targetMember, error: fetchErr } = await supabase
    .from('organization_members')
    .select('*, profile:profiles!user_id(id, email, full_name, avatar_url, phone)')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .single();

  if (fetchErr || !targetMember) {
    return { success: false, error: 'Member not found in this organization.' };
  }

  if (targetMember.user_id === actorUserId) {
    return { success: false, error: 'You cannot change your own membership status.' };
  }

  if (targetMember.role === 'SUPER_ADMIN' || targetMember.role === 'OWNER') {
    return { success: false, error: 'Cannot deactivate an Owner or Super Admin.' };
  }

  const beforeData = {
    status: targetMember.status,
    role: targetMember.role,
  };

  const { data: updatedMember, error: updateErr } = await supabase
    .from('organization_members')
    .update({ status: newStatus })
    .eq('id', memberId)
    .select('*, profile:profiles!user_id(id, email, full_name, avatar_url, phone)')
    .single();

  if (updateErr || !updatedMember) {
    return { success: false, error: updateErr?.message || 'Failed to update member status.' };
  }

  // Record audit log
  await createAuditLog({
    organizationId,
    actorUserId,
    action: 'MEMBER_STATUS_UPDATED',
    entityType: 'organization_members',
    entityId: memberId,
    beforeData,
    afterData: {
      status: newStatus,
      role: updatedMember.role,
    },
    metadata: {
      targetUserId: targetMember.user_id,
      targetEmail: targetMember.profile?.email,
      previousStatus: targetMember.status,
      newStatus,
    },
  });

  return { success: true, member: updatedMember as OrganizationMemberWithProfile };
}

/**
 * Remove a member from the organization
 */
export async function removeMember(
  organizationId: string,
  actorUserId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: targetMember, error: fetchErr } = await supabase
    .from('organization_members')
    .select('*, profile:profiles!user_id(id, email, full_name)')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .single();

  if (fetchErr || !targetMember) {
    return { success: false, error: 'Member not found in this organization.' };
  }

  if (targetMember.user_id === actorUserId) {
    return { success: false, error: 'You cannot remove yourself from the organization.' };
  }

  if (targetMember.role === 'SUPER_ADMIN' || targetMember.role === 'OWNER') {
    return { success: false, error: 'Cannot remove an Owner or Super Admin.' };
  }

  const { error: deleteErr } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId);

  if (deleteErr) {
    return { success: false, error: deleteErr.message };
  }

  // Record audit log
  await createAuditLog({
    organizationId,
    actorUserId,
    action: 'MEMBER_REMOVED',
    entityType: 'organization_members',
    entityId: memberId,
    beforeData: {
      userId: targetMember.user_id,
      email: targetMember.profile?.email,
      role: targetMember.role,
      status: targetMember.status,
    },
    metadata: {
      targetUserId: targetMember.user_id,
      targetEmail: targetMember.profile?.email,
      removedRole: targetMember.role,
    },
  });

  return { success: true };
}
