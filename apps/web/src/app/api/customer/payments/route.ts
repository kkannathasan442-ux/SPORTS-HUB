import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCustomerPaymentHistory } from '@/lib/payments/queries';
import { paymentQuerySchema } from '@/lib/payments/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'You must be signed in to view your payments' },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = paymentQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
    });

    const queryParams = parsedQuery.success ? parsedQuery.data : undefined;
    const result = await getCustomerPaymentHistory(supabase, queryParams);

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
          message: error.message || 'Failed to fetch customer payment history',
        },
      },
      { status: 500 }
    );
  }
}
