import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notificationQuerySchema } from '@sportshub/validation';
import { getUserNotifications, getStaffNotifications } from '@/lib/notifications/notification-service';
import { NOTIFICATION_ERRORS } from '@/lib/notifications/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * 
 * Fetches paginated notifications for the authenticated user or organization.
 * - Customer: accesses their personal notifications.
 * - Staff/Owner: when organizationId is supplied, accesses org-scoped notifications if authorized.
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
            message: 'Authentication required to view notifications',
          },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      organizationId: searchParams.get('organizationId') || undefined,
      unreadOnly: searchParams.get('unreadOnly') === 'true',
      notificationType: searchParams.get('notificationType') || undefined,
      channel: searchParams.get('channel') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20,
    };

    const parsed = notificationQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: NOTIFICATION_ERRORS.INVALID_INPUT,
            message: 'Invalid query parameters',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { organizationId, unreadOnly, page, limit } = parsed.data;

    // Staff / Owner multi-tenant org query
    if (organizationId) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (!member) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: NOTIFICATION_ERRORS.FORBIDDEN,
              message: 'You are not authorized to view notifications for this organization',
            },
          },
          { status: 403 }
        );
      }

      const result = await getStaffNotifications(supabase, organizationId, {
        unreadOnly,
        page,
        limit,
      });

      return NextResponse.json({
        success: true,
        data: result.notifications,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }

    // Customer personal notifications
    const result = await getUserNotifications(supabase, user.id, {
      unreadOnly,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.notifications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: NOTIFICATION_ERRORS.INTERNAL_ERROR,
          message: error?.message || 'Failed to fetch notifications',
        },
      },
      { status: 500 }
    );
  }
}
