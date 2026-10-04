import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/authorization';
import { createMatch } from '@/lib/matches/operations';
import { listMatches } from '@/lib/matches/queries';
import { createMatchSchema, matchQueryFilterSchema } from '@sportshub/validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);

    const filterParsed = matchQueryFilterSchema.safeParse({
      organizationId: searchParams.get('organizationId') || undefined,
      sportId: searchParams.get('sportId') || undefined,
      venueId: searchParams.get('venueId') || undefined,
      facilityId: searchParams.get('facilityId') || undefined,
      status: searchParams.get('status') || undefined,
      matchFormat: searchParams.get('matchFormat') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (!filterParsed.success) {
      return NextResponse.json(
        { success: false, error: filterParsed.error.errors[0]?.message || 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const result = await listMatches(supabase, filterParsed.data);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list matches' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate request FIRST
    const { user } = await requireAuth();

    // 2. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }

    const parsed = createMatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid match payload' },
        { status: 400 }
      );
    }

    // 3. Delegate to authoritative service
    const supabase = await createSupabaseServerClient();
    const result = await createMatch(supabase, parsed.data, { userId: user.id, email: user.email });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'UnauthorizedError' ? 401 : error.name === 'ForbiddenError' ? 403 : 400);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create match' },
      { status }
    );
  }
}
