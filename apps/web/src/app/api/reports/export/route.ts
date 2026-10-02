import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { reportExportSchema } from '@sportshub/validation';
import { generateExecutiveSummaryReport } from '@/lib/reports/analytics-engine';
import { exportReportToCsv } from '@/lib/reports/export';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getActiveOrganizationContext();

    if (!context || !context.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!context.activeOrganization) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ACTIVE_ORG', message: 'No active organization found' } },
        { status: 403 }
      );
    }

    // Role check for export: SUPER_ADMIN, OWNER, MANAGER
    const isAuthorized =
      context.role && ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(context.role);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to export reports' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = reportExportSchema.safeParse({
      format: searchParams.get('format') || 'csv',
      reportType: searchParams.get('reportType') || 'overview',
      timeRangePreset: searchParams.get('timeRangePreset') || 'this_month',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      venueId: searchParams.get('venueId') || undefined,
      facilityId: searchParams.get('facilityId') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid export parameters', details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const orgId = context.activeOrganization.id;

    const report = await generateExecutiveSummaryReport(supabase, {
      organizationId: orgId,
      timeRangePreset: parsed.data.timeRangePreset,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      venueId: parsed.data.venueId,
      facilityId: parsed.data.facilityId,
    });

    const csvContent = exportReportToCsv(report, parsed.data.reportType);
    const filename = `sportshub_${parsed.data.reportType}_report_${report.dateRange.startDate}_${report.dateRange.endDate}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to export report' } },
      { status: 500 }
    );
  }
}
