import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createPaymentTransaction } from '@/lib/payments/create-payment';
import { PAYMENT_ERRORS } from '@/lib/payments/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idempotencyHeader = request.headers.get('x-idempotency-key');
    
    // Explicitly reject price tampering or strip client attempts to forge amount/currency/org
    const payload = {
      bookingId: body.bookingId,
      paymentMethod: body.paymentMethod,
      idempotencyKey: idempotencyHeader || body.idempotencyKey,
      returnUrl: body.returnUrl,
      metadata: body.metadata,
    };

    const supabase = await createSupabaseServerClient();
    const result = await createPaymentTransaction(supabase, payload);

    if (!result.success) {
      const statusCode =
        result.error?.code === PAYMENT_ERRORS.UNAUTHORIZED
          ? 401
          : result.error?.code === PAYMENT_ERRORS.BOOKING_NOT_PAYABLE
          ? 422
          : result.error?.code === PAYMENT_ERRORS.BOOKING_NOT_FOUND
          ? 404
          : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to create payment transaction',
        },
      },
      { status: 500 }
    );
  }
}
