import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import {
  getCustomerAccountProfile,
  updateCustomerAccountProfile,
  getCustomerAccountStats,
} from '@/lib/customer/customer-service';
import { updateCustomerProfileSchema } from '@sportshub/validation';

/**
 * GET /api/customer/profile
 * Get authenticated customer profile & stats
 */
export async function GET() {
  try {
    const { user } = await requireAuth();

    const profile = await getCustomerAccountProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const stats = await getCustomerAccountStats(user.id);

    return NextResponse.json({ profile, stats }, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to fetch customer profile.' }, { status });
  }
}

/**
 * PATCH /api/customer/profile
 * Update customer personal profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAuth();

    const body = await request.json();
    const parsed = updateCustomerProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid profile update payload.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await updateCustomerAccountProfile(user.id, parsed.data);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update profile.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, profile: result.profile }, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to update customer profile.' }, { status });
  }
}
