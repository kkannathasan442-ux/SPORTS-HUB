import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { reportFilterSchema } from '@sportshub/validation';
import { resolveDateRange } from '@/lib/reports/date-utils';
import { fetchOrganizationBookings } from '@/lib/reports/queries';
import { computeCustomerAnalytics } from '@/lib/reports/analytics-engine';

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

    const isAuthorized =
      context.role && ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTIONIST'].includes(context.role);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
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

    const bookings = await fetchOrganizationBookings(supabase, orgId, dateRange.startDate, dateRange.endDate, parsed.data);
    const customerAnalytics = computeCustomerAnalytics(bookings);

    return NextResponse.json({
      success: true,
      data: {
        dateRange,
        customerAnalytics,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to fetch customer reports' } },
      { status: 500 }
    );
  }
}
