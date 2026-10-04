import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateTeamInput, CreateInvitationInput, UpdateMemberRoleInput } from './validation';
import { createAuditLog } from '../audit/audit-service';
import { defaultNotificationDispatcher } from '../notifications/dispatcher';

export async function createTeam(
  supabase: SupabaseClient<any, any, any>,
  input: CreateTeamInput,
  organizationId: string | null = null
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name: input.name,
      sport_id: input.sportId,
      organization_id: organizationId,
      created_by: user.id,
      description: input.description,
      logo_url: input.logoUrl,
    })
    .select('id')
    .single();

  if (teamError || !team) {
    throw new Error(`Failed to create team: ${teamError?.message}`);
  }

  const { error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: user.id,
      role: 'CAPTAIN'
    });

  if (memberError) {
    await supabase.from('teams').delete().eq('id', team.id);
    throw new Error('Failed to assign captain role');
  }

  await createAuditLog({
    action: 'TEAM_CREATED',
    entityType: 'TEAM',
    entityId: team.id,
    organizationId: organizationId || undefined,
    metadata: { name: input.name, sportId: input.sportId },
    actorUserId: user.id,
  });

  return { success: true, teamId: team.id };
}

export async function invitePlayer(
  supabase: SupabaseClient<any, any, any>,
  teamId: string,
  input: CreateInvitationInput
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  // Verify permission
  const { data: membership, error: memError } = await supabase
    .from('team_members')
    .select('role, teams(name, organization_id)')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (memError || !membership) throw new Error('Access denied');
  if (membership.role !== 'CAPTAIN' && membership.role !== 'MANAGER') {
    throw new Error('Only Captain or Manager can invite players');
  }

  // Check if already a member by email
  const { data: existingInvite } = await supabase
    .from('team_invitations')
    .select('id')
    .eq('team_id', teamId)
    .eq('invited_email', input.invitedEmail)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (existingInvite) {
    throw new Error('An invitation is already pending for this email');
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: invite, error: inviteError } = await supabase
    .from('team_invitations')
    .insert({
      team_id: teamId,
      invited_email: input.invitedEmail,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
      status: 'PENDING'
    })
    .select('id')
    .single();

  if (inviteError || !invite) throw new Error(`Failed to create invitation: ${inviteError?.message}`);

  const orgId = Array.isArray(membership.teams) ? membership.teams[0]?.organization_id : (membership.teams as any)?.organization_id;
  const teamName = Array.isArray(membership.teams) ? membership.teams[0]?.name : (membership.teams as any)?.name;

  await createAuditLog({
    action: 'TEAM_MEMBER_INVITED',
    entityType: 'TEAM_INVITATION',
    entityId: invite.id,
    organizationId: orgId || undefined,
    metadata: { teamId, email: input.invitedEmail },
    actorUserId: user.id,
  });

  let recipientRes = null;
  try {
    recipientRes = await supabase
      .from('profiles')
      .select('id')
      .eq('email', input.invitedEmail)
      .maybeSingle();
  } catch(e) {
    // Ignore mock errors
  }

  await defaultNotificationDispatcher.dispatchTeamMemberInvited(
    supabase,
    { id: invite.id, team_id: teamId, invited_email: input.invitedEmail, organization_id: orgId },
    teamName || 'Team',
    user.email || 'A team member',
    recipientRes?.data?.id
  );

  return { success: true, invitationId: invite.id };
}

export async function acceptInvitation(
  supabase: SupabaseClient<any, any, any>,
  invitationId: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  if (!user.email) throw new Error('User has no email');

  const { data: invite, error: fetchError } = await supabase
    .from('team_invitations')
    .select('*, teams(name, is_active, organization_id)')
    .eq('id', invitationId)
    .single();

  if (fetchError || !invite) throw new Error('Invitation not found');
  if (invite.status !== 'PENDING') throw new Error('Invitation is not pending');
  if (new Date(invite.expires_at) < new Date()) throw new Error('Invitation has expired');
  if (invite.invited_email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error('You are not authorized to accept this invitation');
  }
  
  const teamIsActive = Array.isArray(invite.teams) ? invite.teams[0]?.is_active : (invite.teams as any)?.is_active;
  if (!teamIsActive) throw new Error('Team is no longer active');

  const { data: existingMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', invite.team_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMember) throw new Error('You are already a member of this team');

  const { error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: invite.team_id,
      user_id: user.id,
      role: 'PLAYER'
    });

  if (memberError) throw new Error('Failed to join team');

  const { error: updateError } = await supabase
    .from('team_invitations')
    .update({
      status: 'ACCEPTED',
      accepted_by: user.id,
      accepted_at: new Date().toISOString()
    })
    .eq('id', invitationId)
    .eq('status', 'PENDING');

  if (updateError) {
    await supabase.from('team_members').delete().eq('team_id', invite.team_id).eq('user_id', user.id);
    throw new Error('Failed to accept invitation');
  }

  const orgId = Array.isArray(invite.teams) ? invite.teams[0]?.organization_id : (invite.teams as any)?.organization_id;
  const teamName = Array.isArray(invite.teams) ? invite.teams[0]?.name : (invite.teams as any)?.name;

  await createAuditLog({
    action: 'TEAM_MEMBER_JOINED',
    entityType: 'TEAM',
    entityId: invite.team_id,
    organizationId: orgId || undefined,
    metadata: { userId: user.id, invitationId },
    actorUserId: user.id,
  });

  let captainRes = null;
  try {
    captainRes = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', invite.team_id)
      .eq('role', 'CAPTAIN')
      .maybeSingle();
  } catch (e) {
    // Ignore mock errors
  }

  if (captainRes?.data) {
    await defaultNotificationDispatcher.dispatchTeamMemberJoined(
      supabase,
      invite.team_id,
      user.id,
      teamName || 'Team',
      user.email || 'A user',
      captainRes.data.user_id,
      orgId
    );
  }

  return { success: true };
}

export async function removeMember(
  supabase: SupabaseClient<any, any, any>,
  teamId: string,
  targetUserId: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const { data: membership } = await supabase
    .from('team_members')
    .select('role, teams(organization_id)')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('Access denied');
  if (membership.role !== 'CAPTAIN' && user.id !== targetUserId) {
    throw new Error('Only the Captain can remove other members');
  }

  // Prevent removing final captain
  if (user.id === targetUserId && membership.role === 'CAPTAIN') {
    const { data: captains } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('role', 'CAPTAIN');
      
    if (captains && captains.length <= 1) {
      throw new Error('Cannot leave team without assigning a new Captain first');
    }
  }

  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', targetUserId);

  if (deleteError) throw new Error('Failed to remove member');

  const orgId = Array.isArray(membership.teams) ? membership.teams[0]?.organization_id : (membership.teams as any)?.organization_id;

  await createAuditLog({
    action: 'TEAM_MEMBER_REMOVED',
    entityType: 'TEAM',
    entityId: teamId,
    organizationId: orgId || undefined,
    metadata: { removedUserId: targetUserId },
    actorUserId: user.id,
  });

  return { success: true };
}

export async function updateMemberRole(
  supabase: SupabaseClient<any, any, any>,
  teamId: string,
  targetUserId: string,
  newRole: 'MANAGER' | 'PLAYER'
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const { data: membership } = await supabase
    .from('team_members')
    .select('role, teams(organization_id)')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role !== 'CAPTAIN') {
    throw new Error('Only the Captain can change roles');
  }

  if (targetUserId === user.id) {
    throw new Error('Cannot change your own role this way');
  }

  const { error: updateError } = await supabase
    .from('team_members')
    .update({ role: newRole })
    .eq('team_id', teamId)
    .eq('user_id', targetUserId);

  if (updateError) throw new Error('Failed to update role');

  const orgId = Array.isArray(membership.teams) ? membership.teams[0]?.organization_id : (membership.teams as any)?.organization_id;

  await createAuditLog({
    action: 'TEAM_ROLE_CHANGED',
    entityType: 'TEAM',
    entityId: teamId,
    organizationId: orgId || undefined,
    metadata: { targetUserId, newRole },
    actorUserId: user.id,
  });

  return { success: true };
}
