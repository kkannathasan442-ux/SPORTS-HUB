import { NextRequest, NextResponse } from 'next/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { requireOrganizationRole } from '@/lib/auth/authorization';
import {
  fetchOrganizationMembers,
  inviteOrAddMember,
} from '@/lib/members/member-service';
import { inviteMemberSchema } from '@sportshub/validation';

/**
 * GET /api/owner/members
 * Fetch all members of the active organization
 * Roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function GET() {
  try {
    const context = await getActiveOrganizationContext();
    if (!context || !context.activeOrganization) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const orgId = context.activeOrganization.id;
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const members = await fetchOrganizationMembers(orgId);
    return NextResponse.json({ members }, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to fetch members.' }, { status });
  }
}

/**
 * POST /api/owner/members
 * Invite or add a member to the active organization
 * Roles: OWNER, SUPER_ADMIN
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getActiveOrganizationContext();
    if (!context || !context.activeOrganization) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const orgId = context.activeOrganization.id;
    const authContext = await requireOrganizationRole(orgId, ['OWNER', 'SUPER_ADMIN']);

    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid invitation payload.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await inviteOrAddMember(orgId, authContext.user.id, parsed.data);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to add member.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, member: result.member }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to add member.' }, { status });
  }
}
