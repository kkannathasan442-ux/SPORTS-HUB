import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/authorization';
import { getCustomerAccountStats } from '@/lib/customer/customer-service';

/**
 * GET /api/customer/statistics
 * Get real-time customer booking and payment stats
 */
export async function GET() {
  try {
    const { user } = await requireAuth();
    const stats = await getCustomerAccountStats(user.id);
    return NextResponse.json({ stats }, { status: 200 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : err.name === 'ForbiddenError' ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Failed to fetch customer statistics.' }, { status });
  }
}
