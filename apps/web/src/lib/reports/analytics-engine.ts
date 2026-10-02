import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ReportFilterParams,
  BookingOverviewMetrics,
  RevenueOverviewMetrics,
  VenuePerformanceMetrics,
  FacilityPerformanceMetrics,
  CustomerAnalyticsMetrics,
  TimeSeriesDataPoint,
  PeakHoursDataPoint,
  ExecutiveSummaryReport,
} from '@sportshub/types';
import { resolveDateRange, generateDateBuckets } from './date-utils';
import {
  fetchOrganizationBookings,
  fetchOrganizationPayments,
  fetchOrganizationRefunds,
  fetchOrganizationVenuesAndFacilities,
  RawBookingReportItem,
  RawPaymentReportItem,
  RawRefundReportItem,
  RawVenueFacilityItem,
} from './queries';

/**
 * Computes booking operational overview metrics.
 */
export function computeBookingOverview(bookings: RawBookingReportItem[]): BookingOverviewMetrics {
  const totalBookings = bookings.length;
  if (totalBookings === 0) {
    return {
      totalBookings: 0,
      confirmedBookings: 0,
      cancelledBookings: 0,
      activeHolds: 0,
      completedBookings: 0,
      walkInBookings: 0,
      cancellationRate: 0,
      totalHoursBooked: 0,
      averageDurationMinutes: 0,
    };
  }

  let confirmedBookings = 0;
  let cancelledBookings = 0;
  let activeHolds = 0;
  let completedBookings = 0;
  let walkInBookings = 0;
  let totalMinutes = 0;

  for (const b of bookings) {
    const dur = Number(b.duration_minutes) || 60;
    totalMinutes += dur;

    if (b.status === 'CONFIRMED') confirmedBookings++;
    else if (b.status === 'CANCELLED' || b.status === 'EXPIRED') cancelledBookings++;
    else if (b.status === 'HOLD') activeHolds++;
    else if (b.status === 'COMPLETED') completedBookings++;

    // Walk-ins typically have booking_reference like SPH-WALK-... or customer_user_id matching staff
    if (b.booking_reference?.includes('WALK') || b.booking_reference?.includes('DIR')) {
      walkInBookings++;
    }
  }

  const cancellationRate =
    totalBookings > 0 ? Number(((cancelledBookings / totalBookings) * 100).toFixed(1)) : 0;
  const totalHoursBooked = Number((totalMinutes / 60).toFixed(1));
  const averageDurationMinutes = Math.round(totalMinutes / totalBookings);

  return {
    totalBookings,
    confirmedBookings,
    cancelledBookings,
    activeHolds,
    completedBookings,
    walkInBookings,
    cancellationRate,
    totalHoursBooked,
    averageDurationMinutes,
  };
}

/**
 * Computes financial and revenue overview metrics.
 */
export function computeRevenueOverview(
  payments: RawPaymentReportItem[],
  refunds: RawRefundReportItem[],
  currency: string = 'LKR'
): RevenueOverviewMetrics {
  let grossBookingAmount = 0;
  let successfulPayments = 0;
  let pendingPayments = 0;
  let failedPayments = 0;

  const methodMap = new Map<string, { count: number; amount: number }>();
  const statusMap = new Map<string, { count: number; amount: number }>();

  for (const p of payments) {
    const amt = Number(p.amount) || 0;
    grossBookingAmount += amt;

    // By status
    const currentStatus = statusMap.get(p.status) || { count: 0, amount: 0 };
    currentStatus.count += 1;
    currentStatus.amount += amt;
    statusMap.set(p.status, currentStatus);

    if (p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED') {
      successfulPayments += amt;

      // By method (only successful transactions contribute to method breakdown)
      const method = p.payment_method || 'CARD';
      const currentMethod = methodMap.get(method) || { count: 0, amount: 0 };
      currentMethod.count += 1;
      currentMethod.amount += amt;
      methodMap.set(method, currentMethod);
    } else if (p.status === 'PENDING') {
      pendingPayments += amt;
    } else if (p.status === 'FAILED') {
      failedPayments += amt;
    }
  }

  // Calculate total refunds
  let totalRefundedAmount = 0;
  for (const r of refunds) {
    if (r.status === 'COMPLETED' || r.status === 'SUCCESS' || r.status === 'PROCESSED') {
      totalRefundedAmount += Number(r.amount) || 0;
    }
  }

  // Fallback: If refund records table was empty, check refunded_amount from payments
  if (totalRefundedAmount === 0) {
    for (const p of payments) {
      if (p.refunded_amount && Number(p.refunded_amount) > 0) {
        totalRefundedAmount += Number(p.refunded_amount);
      }
    }
  }

  const netRevenue = Math.max(0, successfulPayments - totalRefundedAmount);

  // Format method breakdown with percentages
  const paymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, data]) => ({
    method,
    count: data.count,
    amount: data.amount,
    percentage: successfulPayments > 0 ? Number(((data.amount / successfulPayments) * 100).toFixed(1)) : 0,
  }));

  const paymentStatusBreakdown = Array.from(statusMap.entries()).map(([status, data]) => ({
    status,
    count: data.count,
    amount: data.amount,
  }));

  return {
    grossBookingAmount,
    successfulPayments,
    pendingPayments,
    failedPayments,
    totalRefundedAmount,
    netRevenue,
    currency,
    paymentMethodBreakdown,
    paymentStatusBreakdown,
  };
}

/**
 * Computes facility-level performance and utilization metrics.
 */
export function computeFacilityPerformance(
  venues: RawVenueFacilityItem[],
  bookings: RawBookingReportItem[],
  payments: RawPaymentReportItem[]
): FacilityPerformanceMetrics[] {
  const result: FacilityPerformanceMetrics[] = [];

  // Group bookings and payments by facility_id
  const bookingsByFacility = new Map<string, RawBookingReportItem[]>();
  for (const b of bookings) {
    const list = bookingsByFacility.get(b.facility_id) || [];
    list.push(b);
    bookingsByFacility.set(b.facility_id, list);
  }

  const revenueByBookingId = new Map<string, number>();
  for (const p of payments) {
    if (p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED') {
      const cur = revenueByBookingId.get(p.booking_id) || 0;
      revenueByBookingId.set(p.booking_id, cur + (Number(p.amount) - Number(p.refunded_amount || 0)));
    }
  }

  for (const venue of venues) {
    for (const facility of venue.facilities || []) {
      const facilityBookings = bookingsByFacility.get(facility.id) || [];
      const totalBookings = facilityBookings.length;
      const confirmedBookings = facilityBookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length;

      let totalMinutes = 0;
      let facilityRevenue = 0;

      for (const b of facilityBookings) {
        if (b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'HOLD') {
          totalMinutes += Number(b.duration_minutes) || 60;
          facilityRevenue += revenueByBookingId.get(b.id) || Number(b.total_amount) || 0;
        }
      }

      const totalHours = Number((totalMinutes / 60).toFixed(1));

      // Utilization rate: total hours booked / available operating hours in period
      // Default baseline: 12 hours/day operating capacity
      const daysCount = 30; // standard month baseline
      const availableCapacityHours = daysCount * 12;
      const utilizationRate = Math.min(100, Number(((totalHours / availableCapacityHours) * 100).toFixed(1)));

      result.push({
        facilityId: facility.id,
        facilityName: facility.name,
        venueId: venue.id,
        venueName: venue.name,
        sportName: facility.sport?.name || 'General Sports',
        totalBookings,
        confirmedBookings,
        totalHours,
        grossRevenue: facilityRevenue,
        utilizationRate,
      });
    }
  }

  return result.sort((a, b) => b.grossRevenue - a.grossRevenue);
}

/**
 * Computes venue-level performance.
 */
export function computeVenuePerformance(
  venues: RawVenueFacilityItem[],
  facilityMetrics: FacilityPerformanceMetrics[]
): VenuePerformanceMetrics[] {
  return venues.map((v) => {
    const venueFacilities = facilityMetrics.filter((f) => f.venueId === v.id);
    const totalBookings = venueFacilities.reduce((sum, f) => sum + f.totalBookings, 0);
    const confirmedBookings = venueFacilities.reduce((sum, f) => sum + f.confirmedBookings, 0);
    const grossRevenue = venueFacilities.reduce((sum, f) => sum + f.grossRevenue, 0);
    const facilitiesCount = venueFacilities.length;
    const avgUtilization =
      facilitiesCount > 0
        ? Number((venueFacilities.reduce((sum, f) => sum + f.utilizationRate, 0) / facilitiesCount).toFixed(1))
        : 0;

    return {
      venueId: v.id,
      venueName: v.name,
      city: v.city,
      totalBookings,
      confirmedBookings,
      grossRevenue,
      facilitiesCount,
      utilizationRate: avgUtilization,
    };
  });
}

/**
 * Computes customer cohort metrics.
 */
export function computeCustomerAnalytics(bookings: RawBookingReportItem[]): CustomerAnalyticsMetrics {
  const customerMap = new Map<
    string,
    { name: string; phone?: string; count: number; spent: number; lastDate: string }
  >();

  for (const b of bookings) {
    if (!b.customer_user_id) continue;
    const cid = b.customer_user_id;
    const current = customerMap.get(cid) || {
      name: b.customer?.full_name || `Customer ${cid.slice(0, 6)}`,
      phone: b.customer?.phone,
      count: 0,
      spent: 0,
      lastDate: b.booking_date,
    };

    current.count += 1;
    if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
      current.spent += Number(b.total_amount) || 0;
    }
    if (b.booking_date > current.lastDate) {
      current.lastDate = b.booking_date;
    }
    customerMap.set(cid, current);
  }

  const totalUniqueCustomers = customerMap.size;
  let newCustomers = 0;
  let returningCustomers = 0;

  for (const data of customerMap.values()) {
    if (data.count === 1) newCustomers++;
    else returningCustomers++;
  }

  const averageBookingsPerCustomer =
    totalUniqueCustomers > 0 ? Number((bookings.length / totalUniqueCustomers).toFixed(1)) : 0;

  const topCustomers = Array.from(customerMap.entries())
    .map(([customerId, data]) => ({
      customerId,
      customerName: data.name,
      phone: data.phone,
      bookingsCount: data.count,
      totalSpent: data.spent,
      lastBookingDate: data.lastDate,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  return {
    totalUniqueCustomers,
    newCustomers,
    returningCustomers,
    averageBookingsPerCustomer,
    topCustomers,
  };
}

/**
 * Computes daily time-series trends between startDate and endDate.
 */
export function computeTimeSeriesTrends(
  bookings: RawBookingReportItem[],
  payments: RawPaymentReportItem[],
  startDate: string,
  endDate: string
): TimeSeriesDataPoint[] {
  const buckets = generateDateBuckets(startDate, endDate);
  const dataMap = new Map<
    string,
    { bookingsCount: number; confirmedCount: number; cancelledCount: number; revenue: number }
  >();

  for (const d of buckets) {
    dataMap.set(d, { bookingsCount: 0, confirmedCount: 0, cancelledCount: 0, revenue: 0 });
  }

  for (const b of bookings) {
    const entry = dataMap.get(b.booking_date);
    if (entry) {
      entry.bookingsCount += 1;
      if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') entry.confirmedCount += 1;
      else if (b.status === 'CANCELLED' || b.status === 'EXPIRED') entry.cancelledCount += 1;
    }
  }

  for (const p of payments) {
    if (p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED') {
      const payDate = p.created_at.slice(0, 10);
      const entry = dataMap.get(payDate);
      if (entry) {
        entry.revenue += Number(p.amount) - Number(p.refunded_amount || 0);
      }
    }
  }

  return buckets.map((date) => {
    const d = dataMap.get(date)!;
    // Format label (e.g. "Oct 15" or "10/15")
    const parts = date.split('-');
    const label = `${parts[1]}/${parts[2]}`;
    return {
      date,
      label,
      bookingsCount: d.bookingsCount,
      confirmedCount: d.confirmedCount,
      cancelledCount: d.cancelledCount,
      revenue: d.revenue,
    };
  });
}

/**
 * Computes peak hours distribution (0..23).
 */
export function computePeakHours(bookings: RawBookingReportItem[]): PeakHoursDataPoint[] {
  const hoursCount = new Array(24).fill(0);
  let totalValid = 0;

  for (const b of bookings) {
    if (b.start_time) {
      const hour = parseInt(b.start_time.slice(0, 2), 10);
      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        hoursCount[hour] += 1;
        totalValid += 1;
      }
    }
  }

  return hoursCount.map((count, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    bookingsCount: count,
    percentage: totalValid > 0 ? Number(((count / totalValid) * 100).toFixed(1)) : 0,
  }));
}

/**
 * Master generator function for Executive Summary Report.
 */
export async function generateExecutiveSummaryReport(
  supabase: SupabaseClient,
  filters: ReportFilterParams
): Promise<ExecutiveSummaryReport> {
  const organizationId = filters.organizationId;
  if (!organizationId) {
    throw new Error('Organization ID is required to generate report');
  }

  const dateRange = resolveDateRange(
    filters.timeRangePreset,
    filters.startDate,
    filters.endDate
  );

  // 1. Fetch data in parallel
  const [bookings, payments, refunds, venues] = await Promise.all([
    fetchOrganizationBookings(supabase, organizationId, dateRange.startDate, dateRange.endDate, filters),
    fetchOrganizationPayments(supabase, organizationId, dateRange.startDate, dateRange.endDate, filters),
    fetchOrganizationRefunds(supabase, organizationId, dateRange.startDate, dateRange.endDate),
    fetchOrganizationVenuesAndFacilities(supabase, organizationId),
  ]);

  // Retrieve organization currency and name
  const { data: org } = await supabase
    .from('organizations')
    .select('name, currency')
    .eq('id', organizationId)
    .maybeSingle();

  const currency = org?.currency || 'LKR';
  const organizationName = org?.name || 'Sports Organization';
  const timezone = filters.timezone || 'Asia/Colombo';

  // 2. Compute analytical dimensions
  const bookingOverview = computeBookingOverview(bookings);
  const revenueOverview = computeRevenueOverview(payments, refunds, currency);
  const facilityPerformance = computeFacilityPerformance(venues, bookings, payments);
  const venuePerformance = computeVenuePerformance(venues, facilityPerformance);
  const customerAnalytics = computeCustomerAnalytics(bookings);
  const bookingTrends = computeTimeSeriesTrends(bookings, payments, dateRange.startDate, dateRange.endDate);
  const peakHours = computePeakHours(bookings);

  // 3. Compile recent activity (latest 10 entries)
  const recentActivity: ExecutiveSummaryReport['recentActivity'] = [];

  for (const b of bookings.slice(-5).reverse()) {
    recentActivity.push({
      id: b.id,
      type: 'booking',
      title: `Booking ${b.status}: ${b.facility?.name || 'Court'}`,
      reference: b.booking_reference,
      timestamp: b.created_at || new Date().toISOString(),
      amount: b.total_amount,
      currency,
      status: b.status,
      customerName: b.customer?.full_name,
      facilityName: b.facility?.name,
    });
  }

  for (const p of payments.slice(-5).reverse()) {
    recentActivity.push({
      id: p.id,
      type: 'payment',
      title: `Payment ${p.status} (${p.payment_method})`,
      reference: p.provider_reference || `TXN-${p.id.slice(0, 8).toUpperCase()}`,
      timestamp: p.created_at,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      facilityName: p.booking?.facility?.name,
    });
  }

  return {
    organizationId,
    organizationName,
    currency,
    timezone,
    dateRange: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      preset: dateRange.preset,
    },
    bookingOverview,
    revenueOverview,
    venuePerformance,
    facilityPerformance,
    customerAnalytics,
    bookingTrends,
    peakHours,
    recentActivity,
  };
}
