import type { ExecutiveSummaryReport } from '@sportshub/types';

/**
 * Generates CSV string content for report export.
 */
export function exportReportToCsv(
  report: ExecutiveSummaryReport,
  reportType: 'overview' | 'bookings' | 'revenue' | 'facilities' | 'customers' = 'overview'
): string {
  const sanitize = (val: any): string => {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    // Escape formula injection
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      str = `'${str}`;
    }
    return `"${str}"`;
  };

  const lines: string[] = [];

  // Header metadata
  lines.push(`"SportsHub Report — ${sanitize(report.organizationName || 'Organization').replace(/^"|"$/g, '')}"`);
  lines.push(`"Report Scope: ${reportType.toUpperCase()}"`);
  lines.push(`"Date Range: ${report.dateRange.startDate} to ${report.dateRange.endDate} (${report.dateRange.preset || 'custom'})"`);
  lines.push(`"Generated At: ${new Date().toISOString()}"`);
  lines.push('');

  if (reportType === 'overview' || reportType === 'revenue') {
    lines.push('"--- REVENUE OVERVIEW ---"');
    lines.push('"Gross Booking Amount","Successful Payments","Refunds","Net Revenue","Currency"');
    lines.push(
      [
        report.revenueOverview.grossBookingAmount,
        report.revenueOverview.successfulPayments,
        report.revenueOverview.totalRefundedAmount,
        report.revenueOverview.netRevenue,
        sanitize(report.revenueOverview.currency),
      ].join(',')
    );
    lines.push('');

    lines.push('"--- PAYMENT METHODS ---"');
    lines.push('"Method","Transactions Count","Total Amount","Percentage"');
    for (const m of report.revenueOverview.paymentMethodBreakdown) {
      lines.push([sanitize(m.method), m.count, m.amount, `"${m.percentage}%"`].join(','));
    }
    lines.push('');
  }

  if (reportType === 'overview' || reportType === 'bookings') {
    lines.push('"--- BOOKINGS OVERVIEW ---"');
    lines.push('"Total Bookings","Confirmed","Cancelled","Active Holds","Completed","Walk-Ins","Cancellation Rate (%)","Total Hours Booked"');
    lines.push(
      [
        report.bookingOverview.totalBookings,
        report.bookingOverview.confirmedBookings,
        report.bookingOverview.cancelledBookings,
        report.bookingOverview.activeHolds,
        report.bookingOverview.completedBookings,
        report.bookingOverview.walkInBookings,
        `"${report.bookingOverview.cancellationRate}%"`,
        report.bookingOverview.totalHoursBooked,
      ].join(',')
    );
    lines.push('');
  }

  if (reportType === 'overview' || reportType === 'facilities') {
    lines.push('"--- FACILITY PERFORMANCE & UTILIZATION ---"');
    lines.push('"Facility Name","Venue","Sport","Total Bookings","Confirmed Bookings","Total Hours Booked","Gross Revenue","Utilization Rate (%)"');
    for (const f of report.facilityPerformance) {
      lines.push(
        [
          sanitize(f.facilityName),
          sanitize(f.venueName),
          sanitize(f.sportName),
          f.totalBookings,
          f.confirmedBookings,
          f.totalHours,
          f.grossRevenue,
          `"${f.utilizationRate}%"`,
        ].join(',')
      );
    }
    lines.push('');
  }

  if (reportType === 'overview' || reportType === 'customers') {
    lines.push('"--- CUSTOMER ANALYTICS ---"');
    lines.push('"Total Unique Customers","New Customers","Returning Customers","Average Bookings Per Customer"');
    lines.push(
      [
        report.customerAnalytics.totalUniqueCustomers,
        report.customerAnalytics.newCustomers,
        report.customerAnalytics.returningCustomers,
        report.customerAnalytics.averageBookingsPerCustomer,
      ].join(',')
    );
    lines.push('');

    lines.push('"--- TOP ACTIVE CUSTOMERS ---"');
    lines.push('"Customer Name","Total Bookings","Total Spent","Last Booking Date"');
    for (const c of report.customerAnalytics.topCustomers) {
      lines.push([sanitize(c.customerName), c.bookingsCount, c.totalSpent, sanitize(c.lastBookingDate || 'N/A')].join(','));
    }
    lines.push('');
  }

  return lines.join('\n');
}
