import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/authorization';
import { transitionMatchStatus } from '@/lib/matches/operations';
import { transitionMatchStatusSchema } from '@sportshub/validation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }

    const parsed = transitionMatchStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid transition payload' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const result = await transitionMatchStatus(supabase, params.id, parsed.data, {
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'UnauthorizedError' ? 401 : error.name === 'ForbiddenError' ? 403 : 400);
    return NextResponse.json(
      { success: false, error: error.message || 'Status transition failed' },
      { status }
    );
  }
}
