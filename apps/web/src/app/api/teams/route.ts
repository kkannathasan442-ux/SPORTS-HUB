import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createTeam } from '../../../lib/teams/operations';
import { CreateTeamSchema } from '../../../lib/teams/validation';
import { requireAuth } from '@/lib/auth/authorization';

export async function POST(request: Request) {
  try {
    await requireAuth();
    
    const supabase = await createSupabaseServerClient();
    const body = await request.json();

    const validated = CreateTeamSchema.parse(body);

    const { teamId } = await createTeam(supabase, validated, null);
    
    return NextResponse.json({ success: true, teamId });
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'UnauthorizedError' ? 401 : error.name === 'ForbiddenError' ? 403 : 400);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create team' },
      { status }
    );
  }
}
