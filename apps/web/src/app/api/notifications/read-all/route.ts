import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { markAllAsRead } from '@/lib/notifications/notification-service';
import { NOTIFICATION_ERRORS } from '@/lib/notifications/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/read-all
 * 
 * Atomically marks all unread notifications as read for the authenticated user.
 */
export async function POST(request: NextRequest) {
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

    const updatedCount = await markAllAsRead(supabase, user.id);

    return NextResponse.json({
      success: true,
      updatedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: NOTIFICATION_ERRORS.INTERNAL_ERROR,
          message: error?.message || 'Failed to mark all notifications as read',
        },
      },
      { status: 500 }
    );
  }
}
