import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUnreadCount } from '@/lib/notifications/notification-service';
import { NOTIFICATION_ERRORS } from '@/lib/notifications/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/unread-count
 * 
 * Returns the exact server-authoritative unread notification count for the signed-in user.
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

    const unreadCount = await getUnreadCount(supabase, user.id);

    return NextResponse.json({
      success: true,
      unreadCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: NOTIFICATION_ERRORS.INTERNAL_ERROR,
          message: error?.message || 'Failed to fetch unread notification count',
        },
      },
      { status: 500 }
    );
  }
}
