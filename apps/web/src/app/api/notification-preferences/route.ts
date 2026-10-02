import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateNotificationPreferencesSchema } from '@sportshub/validation';
import { getUserPreferences, updateUserPreferences } from '@/lib/notifications/notification-service';
import { NOTIFICATION_ERRORS } from '@/lib/notifications/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notification-preferences
 * Returns the preferences of the current user.
 */
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
          error: {
            code: NOTIFICATION_ERRORS.UNAUTHORIZED,
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const preferences = await getUserPreferences(supabase, user.id);

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: NOTIFICATION_ERRORS.INTERNAL_ERROR,
          message: error?.message || 'Failed to fetch notification preferences',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notification-preferences
 * Updates preference settings for the current user.
 */
export async function PATCH(request: NextRequest) {
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
          error: {
            code: NOTIFICATION_ERRORS.UNAUTHORIZED,
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateNotificationPreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: NOTIFICATION_ERRORS.INVALID_INPUT,
            message: 'Invalid preferences payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const updated = await updateUserPreferences(supabase, user.id, parsed.data);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: NOTIFICATION_ERRORS.INTERNAL_ERROR,
          message: error?.message || 'Failed to update notification preferences',
        },
      },
      { status: 500 }
    );
  }
}
