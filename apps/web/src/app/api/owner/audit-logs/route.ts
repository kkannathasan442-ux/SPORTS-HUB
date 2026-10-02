import { NextRequest, NextResponse } from 'next/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { requireOrganizationRole } from '@/lib/auth/authorization';
import { fetchOrganizationAuditLogs } from '@/lib/audit/audit-service';
import { auditLogFilterSchema } from '@sportshub/validation';

/**
 * GET /api/owner/audit-logs
 * Fetch immutable audit logs for the active organization
 * Roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getActiveOrganizationContext();
    if (!context || !context.activeOrganization) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const orgId = context.activeOrganization.id;
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const searchParams = request.nextUrl.searchParams;
    const queryInput = {
      action: searchParams.get('action') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      actorUserId: searchParams.get('actorUserId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const parsed = auditLogFilterSchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid audit log query parameters.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await fetchOrganizationAuditLogs(orgId, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to fetch audit logs.' }, { status });
  }
}
