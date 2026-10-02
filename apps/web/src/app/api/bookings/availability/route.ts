import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getFacilityAvailability } from '@/lib/bookings/availability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId');
    const date = searchParams.get('date');
    const durationMinutes = searchParams.get('durationMinutes')
      ? parseInt(searchParams.get('durationMinutes')!, 10)
      : 60;

    if (!facilityId || !date) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameters: facilityId and date' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const result = await getFacilityAvailability(supabase, {
      facilityId,
      date,
      durationMinutes,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
