import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { processPaymentRefund } from '@/lib/payments/refund';
import { PAYMENT_ERRORS } from '@/lib/payments/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idempotencyHeader = request.headers.get('x-idempotency-key');

    const payload = {
      paymentTransactionId: body.paymentTransactionId,
      amount: body.amount,
      reason: body.reason,
      idempotencyKey: idempotencyHeader || body.idempotencyKey,
    };

    const supabase = await createSupabaseServerClient();
    const result = await processPaymentRefund(supabase, payload);

    if (!result.success) {
      const statusCode =
        result.error?.code === PAYMENT_ERRORS.UNAUTHORIZED
          ? 401
          : result.error?.code === PAYMENT_ERRORS.FORBIDDEN
          ? 403
          : result.error?.code === PAYMENT_ERRORS.TRANSACTION_NOT_FOUND
          ? 404
          : result.error?.code === PAYMENT_ERRORS.REFUND_EXCEEDS_AMOUNT ||
            result.error?.code === PAYMENT_ERRORS.ALREADY_REFUNDED ||
            result.error?.code === PAYMENT_ERRORS.INVALID_STATUS_TRANSITION
          ? 422
          : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to process refund',
        },
      },
      { status: 500 }
    );
  }
}
