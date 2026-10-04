import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/authorization';
import { updateCompetitor, removeCompetitor } from '@/lib/matches/operations';
import { updateCompetitorSchema } from '@sportshub/validation';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; competitorId: string } }
) {
  try {
    const { user } = await requireAuth();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }

    const parsed = updateCompetitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const result = await updateCompetitor(supabase, params.id, params.competitorId, parsed.data, {
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'UnauthorizedError' ? 401 : error.name === 'ForbiddenError' ? 403 : 400);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update competitor' },
      { status }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; competitorId: string } }
) {
  try {
    const { user } = await requireAuth();

    const supabase = await createSupabaseServerClient();
    const result = await removeCompetitor(supabase, params.id, params.competitorId, {
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'UnauthorizedError' ? 401 : error.name === 'ForbiddenError' ? 403 : 400);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove competitor' },
      { status }
    );
  }
}
