import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { reportFilterSchema } from '@sportshub/validation';
import { resolveDateRange } from '@/lib/reports/date-utils';
import { fetchOrganizationPayments, fetchOrganizationRefunds } from '@/lib/reports/queries';
import { computeRevenueOverview } from '@/lib/reports/analytics-engine';

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

    // Strict financial permission check: OWNER, MANAGER, SUPER_ADMIN
    const isAuthorized =
      context.role && ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(context.role);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view financial reports' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = reportFilterSchema.safeParse({
      timeRangePreset: searchParams.get('timeRangePreset') || 'this_month',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      paymentStatus: searchParams.get('paymentStatus') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      timezone: searchParams.get('timezone') || 'Asia/Colombo',
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid query', details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const dateRange = resolveDateRange(parsed.data.timeRangePreset, parsed.data.startDate, parsed.data.endDate);
    const supabase = await createSupabaseServerClient();
    const orgId = context.activeOrganization.id;

    const [payments, refunds] = await Promise.all([
      fetchOrganizationPayments(supabase, orgId, dateRange.startDate, dateRange.endDate, parsed.data),
      fetchOrganizationRefunds(supabase, orgId, dateRange.startDate, dateRange.endDate),
    ]);

    const { data: org } = await supabase
      .from('organizations')
      .select('currency')
      .eq('id', orgId)
      .maybeSingle();

    const currency = org?.currency || 'LKR';
    const revenueOverview = computeRevenueOverview(payments, refunds, currency);

    return NextResponse.json({
      success: true,
      data: {
        dateRange,
        currency,
        revenueOverview,
        totalTransactions: payments.length,
        totalRefunds: refunds.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to fetch revenue report' } },
      { status: 500 }
    );
  }
}
