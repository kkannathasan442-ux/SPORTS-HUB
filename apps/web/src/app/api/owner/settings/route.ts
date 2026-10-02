import { NextRequest, NextResponse } from 'next/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { requireOrganizationRole } from '@/lib/auth/authorization';
import {
  fetchOrganizationWithSettings,
  updateOrganizationWithSettings,
} from '@/lib/settings/settings-service';
import { updateOrganizationSettingsSchema } from '@sportshub/validation';

/**
 * GET /api/owner/settings
 * Read organization profile and operational settings
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

    const organization = await fetchOrganizationWithSettings(orgId);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }

    return NextResponse.json({ organization }, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to fetch settings.' }, { status });
  }
}

/**
 * PATCH /api/owner/settings
 * Update organization profile and operational settings
 * Roles: OWNER, SUPER_ADMIN
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = await getActiveOrganizationContext();
    if (!context || !context.activeOrganization) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const orgId = context.activeOrganization.id;
    const authContext = await requireOrganizationRole(orgId, ['OWNER', 'SUPER_ADMIN']);

    const body = await request.json();
    const parsed = updateOrganizationSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings payload.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await updateOrganizationWithSettings(
      orgId,
      authContext.user.id,
      parsed.data
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update settings.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, organization: result.organization }, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to update settings.' }, { status });
  }
}
