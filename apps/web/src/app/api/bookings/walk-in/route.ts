import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { walkInBookingSchema } from '@sportshub/validation';
import { createWalkInBooking } from '@/lib/bookings/queries';
import { BOOKING_ERRORS } from '@/lib/bookings/types';
import { defaultNotificationDispatcher } from '@/lib/notifications/dispatcher';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const context = await getActiveOrganizationContext();

    if (!context || !context.profile) {
      return NextResponse.json(
        { success: false, error: { code: BOOKING_ERRORS.UNAUTHORIZED, message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const allowedRoles = ['RECEPTIONIST', 'MANAGER', 'OWNER', 'SUPER_ADMIN', 'venue_owner', 'manager', 'receptionist', 'super_admin'];
    const hasPermission = context.role && allowedRoles.includes(context.role);

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: BOOKING_ERRORS.UNAUTHORIZED,
            message: 'You do not have permission to create walk-in desk bookings',
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = walkInBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: BOOKING_ERRORS.BOOKING_FAILED,
            message: 'Validation failed',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const bookingInput = {
      ...parsed.data,
      sportId: parsed.data.sportId || undefined,
      customerEmail: parsed.data.customerEmail || undefined,
      notes: parsed.data.notes || undefined,
    };

    const booking = await createWalkInBooking(supabase, context.profile.id, bookingInput);

    // Safe isolated notification dispatch
    try {
      defaultNotificationDispatcher
        .dispatchWalkInBookingCreated(supabase, booking as any, context.profile.id)
        .catch((e) => console.warn('Failed to dispatch walk-in notification:', e));
    } catch (e) {
      console.warn('Notification trigger error:', e);
    }

    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (error: any) {
    const isConflict = error.message?.includes('already booked') || error.message?.includes('prevent_double_booking');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isConflict ? BOOKING_ERRORS.SLOT_UNAVAILABLE : 'INTERNAL_ERROR',
          message: error.message || 'Failed to create walk-in booking',
        },
      },
      { status: isConflict ? 409 : 500 }
    );
  }
}

