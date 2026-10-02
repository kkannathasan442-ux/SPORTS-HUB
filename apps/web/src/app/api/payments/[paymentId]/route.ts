import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPaymentById } from '@/lib/payments/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'You must be signed in to view this payment' },
        },
        { status: 401 }
      );
    }

    const payment = await getPaymentById(supabase, paymentId);

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Payment transaction not found' },
        },
        { status: 404 }
      );
    }

    // Check authorization: must be the customer or an active organization member
    if (payment.customer_user_id !== user.id) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', payment.organization_id)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'You do not have access to this payment' },
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to fetch payment transaction',
        },
      },
      { status: 500 }
    );
  }
}
