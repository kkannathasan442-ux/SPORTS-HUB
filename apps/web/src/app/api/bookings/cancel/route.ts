import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cancelBooking } from '@/lib/bookings/cancel-booking';
import { BOOKING_ERRORS } from '@/lib/bookings/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createSupabaseServerClient();

    const result = await cancelBooking(supabase, body);

    if (!result.success) {
      const statusCode =
        result.error?.code === BOOKING_ERRORS.UNAUTHORIZED
          ? 403
          : result.error?.code === BOOKING_ERRORS.BOOKING_NOT_FOUND
          ? 404
          : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to cancel booking' },
      },
      { status: 500 }
    );
  }
}
