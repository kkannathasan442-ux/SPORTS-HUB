import { NextRequest, NextResponse } from 'next/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { requireOrganizationRole } from '@/lib/auth/authorization';
import {
  updateMemberRole,
  updateMemberStatus,
  removeMember,
} from '@/lib/members/member-service';
import {
  updateMemberRoleSchema,
  updateMemberStatusSchema,
} from '@sportshub/validation';

interface RouteParams {
  params: {
    memberId: string;
  };
}

/**
 * PATCH /api/owner/members/[memberId]
 * Update member role or membership status
 * Roles: OWNER, SUPER_ADMIN
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getActiveOrganizationContext();
    if (!context || !context.activeOrganization) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const orgId = context.activeOrganization.id;
    const authContext = await requireOrganizationRole(orgId, ['OWNER', 'SUPER_ADMIN']);
    const { memberId } = params;

    const body = await request.json();

    // Check if role update
    if (body.role !== undefined) {
      const parsedRole = updateMemberRoleSchema.safeParse(body);
      if (!parsedRole.success) {
        return NextResponse.json(
          { error: 'Invalid role update payload.', details: parsedRole.error.flatten() },
          { status: 400 }
        );
      }

      const result = await updateMemberRole(
        orgId,
        authContext.user.id,
        memberId,
        parsedRole.data.role
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to update role.' }, { status: 400 });
      }

      return NextResponse.json({ success: true, member: result.member }, { status: 200 });
    }

    // Check if status update
    if (body.status !== undefined) {
      const parsedStatus = updateMemberStatusSchema.safeParse(body);
      if (!parsedStatus.success) {
        return NextResponse.json(
          { error: 'Invalid status update payload.', details: parsedStatus.error.flatten() },
          { status: 400 }
        );
      }

      const result = await updateMemberStatus(
        orgId,
        authContext.user.id,
        memberId,
        parsedStatus.data.status
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to update status.' }, { status: 400 });
      }

      return NextResponse.json({ success: true, member: result.member }, { status: 200 });
    }

    return NextResponse.json({ error: 'Specify either role or status in update payload.' }, { status: 400 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to update member.' }, { status });
  }
}

/**
 * DELETE /api/owner/members/[memberId]
 * Remove a member from the active organization
 * Roles: OWNER, SUPER_ADMIN
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getActiveOrganizationContext();
    if (!context || !context.activeOrganization) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const orgId = context.activeOrganization.id;
    const authContext = await requireOrganizationRole(orgId, ['OWNER', 'SUPER_ADMIN']);
    const { memberId } = params;

    const result = await removeMember(orgId, authContext.user.id, memberId);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to remove member.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Member removed successfully.' }, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to remove member.' }, { status });
  }
}
