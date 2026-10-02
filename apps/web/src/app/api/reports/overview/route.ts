import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { reportFilterSchema } from '@sportshub/validation';
import { generateExecutiveSummaryReport } from '@/lib/reports/analytics-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/overview
 * 
 * Returns the executive summary report for the active organization.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getActiveOrganizationContext();

    if (!context || !context.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'You must be signed in to access reports' },
        },
        { status: 401 }
      );
    }

    if (!context.activeOrganization) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NO_ACTIVE_ORG', message: 'No active organization found' },
        },
        { status: 403 }
      );
    }

    // RBAC: Check role
    const isAuthorized =
      context.role && ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTIONIST'].includes(context.role);

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to view organization reports' },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = reportFilterSchema.safeParse({
      timeRangePreset: searchParams.get('timeRangePreset') || 'this_month',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      venueId: searchParams.get('venueId') || undefined,
      facilityId: searchParams.get('facilityId') || undefined,
      bookingStatus: searchParams.get('bookingStatus') || undefined,
      paymentStatus: searchParams.get('paymentStatus') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      timezone: searchParams.get('timezone') || 'Asia/Colombo',
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid report query parameters',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const report = await generateExecutiveSummaryReport(supabase, {
      ...parsed.data,
      organizationId: context.activeOrganization.id,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message || 'Failed to generate overview report',
        },
      },
      { status: 500 }
    );
  }
}
