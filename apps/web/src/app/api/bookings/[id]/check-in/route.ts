import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkInBooking } from '@/lib/bookings/operations';
import { BOOKING_ERRORS } from '@/lib/bookings/types';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getActiveOrganizationContext();
    if (!context || !context.profile) {
      return NextResponse.json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
    }

    // Role check (can be expanded via RBAC)
    const allowedRoles = ['RECEPTIONIST', 'MANAGER', 'OWNER', 'SUPER_ADMIN'];
    if (!context.role || !allowedRoles.includes(context.role.toUpperCase())) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized role' } }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();
    const result = await checkInBooking(supabase, params.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }
}
