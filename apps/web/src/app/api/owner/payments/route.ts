import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getOwnerPaymentLedger } from '@/lib/payments/queries';
import { paymentQuerySchema } from '@/lib/payments/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getActiveOrganizationContext();

    if (!context || !context.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'You must be signed in to view organization payments' },
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

    const isAuthorized =
      context.role && ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTIONIST'].includes(context.role);

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to view financial transactions' },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = paymentQuerySchema.safeParse({
      venueId: searchParams.get('venueId') || undefined,
      status: searchParams.get('status') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
    });

    const queryParams = parsedQuery.success ? parsedQuery.data : undefined;
    const supabase = await createSupabaseServerClient();
    const result = await getOwnerPaymentLedger(
      supabase,
      context.activeOrganization.id,
      queryParams
    );

    return NextResponse.json({
      success: true,
      data: result.payments,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: Math.ceil(result.totalCount / result.pageSize),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to fetch owner payments',
        },
      },
      { status: 500 }
    );
  }
}
