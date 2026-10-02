import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createBookingHold } from '@/lib/bookings/create-hold';
import { BOOKING_ERRORS } from '@/lib/bookings/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createSupabaseServerClient();

    const result = await createBookingHold(supabase, body);

    if (!result.success) {
      const statusCode =
        result.error?.code === BOOKING_ERRORS.UNAUTHORIZED
          ? 401
          : result.error?.code === BOOKING_ERRORS.SLOT_UNAVAILABLE
          ? 409
          : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create booking hold' },
      },
      { status: 500 }
    );
  }
}
