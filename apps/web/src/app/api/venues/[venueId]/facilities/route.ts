import { NextRequest, NextResponse } from 'next/server';
import { getVenueFacilities } from '@/lib/owner/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { venueId: string } }
) {
  try {
    const { venueId } = params;
    if (!venueId) {
      return NextResponse.json({ success: false, error: 'Venue ID is required' }, { status: 400 });
    }

    const facilities = await getVenueFacilities(venueId);

    return NextResponse.json({ success: true, facilities });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch facilities' },
      { status: 500 }
    );
  }
}
