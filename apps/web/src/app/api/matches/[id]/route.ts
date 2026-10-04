import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/authorization';
import { getMatchWithDetails } from '@/lib/matches/queries';
import { updateMatch, deleteMatch } from '@/lib/matches/operations';
import { updateMatchSchema } from '@sportshub/validation';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const match = await getMatchWithDetails(supabase, params.id);

    if (!match) {
      return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, match });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve match' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate request FIRST
    const { user } = await requireAuth();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }

    const parsed = updateMatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const result = await updateMatch(supabase, params.id, parsed.data, { userId: user.id, email: user.email });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'UnauthorizedError' ? 401 : error.name === 'ForbiddenError' ? 403 : 400);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update match' },
      { status }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate request FIRST
    const { user } = await requireAuth();

    const supabase = await createSupabaseServerClient();
    const result = await deleteMatch(supabase, params.id, { userId: user.id, email: user.email });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'UnauthorizedError' ? 401 : error.name === 'ForbiddenError' ? 403 : 400);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete match' },
      { status }
    );
  }
}
