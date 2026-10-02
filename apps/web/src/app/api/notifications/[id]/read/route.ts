import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { markAsRead } from '@/lib/notifications/notification-service';
import { NOTIFICATION_ERRORS } from '@/lib/notifications/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/notifications/[id]/read
 * 
 * Marks a single notification as read by the recipient.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: NOTIFICATION_ERRORS.INVALID_INPUT,
            message: 'Notification ID is required',
          },
        },
        { status: 400 }
      );
    }

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

    const updated = await markAsRead(supabase, id, user.id);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: NOTIFICATION_ERRORS.NOTIFICATION_NOT_FOUND,
            message: 'Notification not found or does not belong to you',
          },
        },
        { status: 404 }
      );
    }

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
          message: error?.message || 'Failed to mark notification as read',
        },
      },
      { status: 500 }
    );
  }
}
