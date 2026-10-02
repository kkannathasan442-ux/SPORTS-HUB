import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { getCustomerBookingHistory } from '@/lib/customer/customer-service';
import { customerBookingQuerySchema } from '@sportshub/validation';

/**
 * GET /api/customer/bookings
 * Get customer booking history with tab filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const queryInput = {
      tab: searchParams.get('tab') || 'all',
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const parsed = customerBookingQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid booking query parameters.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await getCustomerBookingHistory(
      user.id,
      parsed.data.tab,
      parsed.data.page,
      parsed.data.limit
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to fetch customer bookings.' }, { status });
  }
}
