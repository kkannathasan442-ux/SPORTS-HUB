import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getOwnerFinancialSummary } from '@/lib/payments/queries';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const context = await getActiveOrganizationContext();

    if (!context || !context.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'You must be signed in to view organization financials' },
        },
        { status: 401 }
      );
    }

    if (!context.activeOrganization) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NO_ACTIVE_ORG', message: 'No active organization found' },
        },
        { status: 403 }
      );
    }

    const isAuthorized =
      context.role && ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(context.role);

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to view financial summary' },
        },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const summary = await getOwnerFinancialSummary(
      supabase,
      context.activeOrganization.id
    );

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to compute financial summary',
        },
      },
      { status: 500 }
    );
  }
}
