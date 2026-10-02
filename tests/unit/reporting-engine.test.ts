import { describe, it, expect } from 'vitest';
import {
  resolveDateRange,
  generateDateBuckets,
} from '../../apps/web/src/lib/reports/date-utils';
import {
  computeBookingOverview,
  computeRevenueOverview,
  computeFacilityPerformance,
  computeVenuePerformance,
  computeCustomerAnalytics,
  computeTimeSeriesTrends,
  computePeakHours,
} from '../../apps/web/src/lib/reports/analytics-engine';
import { exportReportToCsv } from '../../apps/web/src/lib/reports/export';
import type {
  RawBookingReportItem,
  RawPaymentReportItem,
  RawRefundReportItem,
  RawVenueFacilityItem,
} from '../../apps/web/src/lib/reports/queries';
import type { ExecutiveSummaryReport } from '@sportshub/types';

describe('STEP 9 — Reporting Engine & Analytics Unit Tests', () => {
  // ==========================================================================
  // 1. Date Range Resolution Tests
  // ==========================================================================
  describe('Date Range Resolution', () => {
    const fixedDate = new Date('2026-10-15T10:00:00Z');

    it('resolves "today" correctly', () => {
      const res = resolveDateRange('today', undefined, undefined, fixedDate);
      expect(res.startDate).toBe('2026-10-15');
      expect(res.endDate).toBe('2026-10-15');
      expect(res.preset).toBe('today');
    });

    it('resolves "yesterday" correctly', () => {
      const res = resolveDateRange('yesterday', undefined, undefined, fixedDate);
      expect(res.startDate).toBe('2026-10-14');
      expect(res.endDate).toBe('2026-10-14');
    });

    it('resolves "this_month" correctly', () => {
      const res = resolveDateRange('this_month', undefined, undefined, fixedDate);
      expect(res.startDate).toBe('2026-10-01');
      expect(res.endDate).toBe('2026-10-31');
    });

    it('resolves "previous_month" correctly', () => {
      const res = resolveDateRange('previous_month', undefined, undefined, fixedDate);
      expect(res.startDate).toBe('2026-09-01');
      expect(res.endDate).toBe('2026-09-30');
    });

    it('resolves "custom" date range when provided', () => {
      const res = resolveDateRange('custom', '2026-06-01', '2026-06-15', fixedDate);
      expect(res.startDate).toBe('2026-06-01');
      expect(res.endDate).toBe('2026-06-15');
    });

    it('generates daily date buckets correctly', () => {
      const buckets = generateDateBuckets('2026-10-01', '2026-10-05');
      expect(buckets).toEqual([
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-05',
      ]);
    });
  });

  // ==========================================================================
  // 2. Booking Overview Metrics Calculation
  // ==========================================================================
  describe('Booking Overview Calculation', () => {
    it('computes empty bookings safely without divide-by-zero', () => {
      const metrics = computeBookingOverview([]);
      expect(metrics.totalBookings).toBe(0);
      expect(metrics.confirmedBookings).toBe(0);
      expect(metrics.cancellationRate).toBe(0);
      expect(metrics.totalHoursBooked).toBe(0);
    });

    it('calculates confirmed, cancelled, active holds, and cancellation rate', () => {
      const mockBookings: RawBookingReportItem[] = [
        {
          id: 'b-1',
          booking_reference: 'SPH-001',
          customer_user_id: 'u-1',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-10',
          start_time: '10:00',
          end_time: '11:00',
          duration_minutes: 60,
          status: 'CONFIRMED',
          subtotal: 2000,
          total_amount: 2000,
          currency: 'LKR',
          created_at: '2026-10-01',
        },
        {
          id: 'b-2',
          booking_reference: 'SPH-002',
          customer_user_id: 'u-2',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-10',
          start_time: '11:00',
          end_time: '12:30',
          duration_minutes: 90,
          status: 'CONFIRMED',
          subtotal: 3000,
          total_amount: 3000,
          currency: 'LKR',
          created_at: '2026-10-01',
        },
        {
          id: 'b-3',
          booking_reference: 'SPH-003',
          customer_user_id: 'u-3',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-11',
          start_time: '14:00',
          end_time: '15:00',
          duration_minutes: 60,
          status: 'CANCELLED',
          subtotal: 2000,
          total_amount: 2000,
          currency: 'LKR',
          created_at: '2026-10-02',
        },
        {
          id: 'b-4',
          booking_reference: 'SPH-WALK-004',
          customer_user_id: 'u-4',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-12',
          start_time: '16:00',
          end_time: '17:00',
          duration_minutes: 60,
          status: 'CONFIRMED',
          subtotal: 2000,
          total_amount: 2000,
          currency: 'LKR',
          created_at: '2026-10-02',
        },
      ];

      const metrics = computeBookingOverview(mockBookings);
      expect(metrics.totalBookings).toBe(4);
      expect(metrics.confirmedBookings).toBe(3);
      expect(metrics.cancelledBookings).toBe(1);
      expect(metrics.walkInBookings).toBe(1);
      expect(metrics.cancellationRate).toBe(25.0); // 1 out of 4 = 25%
      expect(metrics.totalHoursBooked).toBe(4.5); // (60 + 90 + 60 + 60) / 60 = 4.5
      expect(metrics.averageDurationMinutes).toBe(68); // 270 / 4 = 67.5 -> 68
    });
  });

  // ==========================================================================
  // 3. Revenue Overview Metrics Calculation (Net Revenue & Refunds)
  // ==========================================================================
  describe('Revenue Overview Calculation', () => {
    it('correctly calculates net revenue by subtracting refunds from successful payments', () => {
      const mockPayments: RawPaymentReportItem[] = [
        {
          id: 'p-1',
          organization_id: 'org-1',
          booking_id: 'b-1',
          customer_user_id: 'u-1',
          amount: 5000,
          refunded_amount: 0,
          currency: 'LKR',
          payment_method: 'STRIPE',
          status: 'SUCCESS',
          created_at: '2026-10-05T10:00:00Z',
        },
        {
          id: 'p-2',
          organization_id: 'org-1',
          booking_id: 'b-2',
          customer_user_id: 'u-2',
          amount: 3000,
          refunded_amount: 1000,
          currency: 'LKR',
          payment_method: 'CARD',
          status: 'PARTIALLY_REFUNDED',
          created_at: '2026-10-06T10:00:00Z',
        },
        {
          id: 'p-3',
          organization_id: 'org-1',
          booking_id: 'b-3',
          customer_user_id: 'u-3',
          amount: 2000,
          refunded_amount: 0,
          currency: 'LKR',
          payment_method: 'CARD',
          status: 'FAILED',
          created_at: '2026-10-07T10:00:00Z',
        },
        {
          id: 'p-4',
          organization_id: 'org-1',
          booking_id: 'b-4',
          customer_user_id: 'u-4',
          amount: 4000,
          refunded_amount: 0,
          currency: 'LKR',
          payment_method: 'BANK_TRANSFER',
          status: 'PENDING',
          created_at: '2026-10-08T10:00:00Z',
        },
      ];

      const mockRefunds: RawRefundReportItem[] = [
        {
          id: 'ref-1',
          organization_id: 'org-1',
          payment_transaction_id: 'p-2',
          amount: 1000,
          currency: 'LKR',
          status: 'COMPLETED',
          created_at: '2026-10-06T12:00:00Z',
        },
      ];

      const revenue = computeRevenueOverview(mockPayments, mockRefunds, 'LKR');

      expect(revenue.grossBookingAmount).toBe(14000); // 5000 + 3000 + 2000 + 4000
      expect(revenue.successfulPayments).toBe(8000); // 5000 (SUCCESS) + 3000 (PARTIALLY_REFUNDED)
      expect(revenue.pendingPayments).toBe(4000); // 4000
      expect(revenue.failedPayments).toBe(2000); // 2000
      expect(revenue.totalRefundedAmount).toBe(1000); // 1000
      expect(revenue.netRevenue).toBe(7000); // 8000 - 1000 = 7000 Net Revenue

      // Payment method breakdown
      expect(revenue.paymentMethodBreakdown.length).toBe(2);
      const stripeMethod = revenue.paymentMethodBreakdown.find((m) => m.method === 'STRIPE');
      expect(stripeMethod?.amount).toBe(5000);
      expect(stripeMethod?.percentage).toBe(62.5); // 5000 / 8000 = 62.5%
    });
  });

  // ==========================================================================
  // 4. Facility Performance & Utilization Calculation
  // ==========================================================================
  describe('Facility Performance & Utilization', () => {
    it('aggregates per-facility bookings, hours, and revenue', () => {
      const mockVenues: RawVenueFacilityItem[] = [
        {
          id: 'v-1',
          name: 'Colombo Central Arena',
          facilities: [
            {
              id: 'f-1',
              name: 'Badminton Court 1',
              venue_id: 'v-1',
              is_bookable: true,
              default_duration_minutes: 60,
              sport: { name: 'Badminton' },
            },
            {
              id: 'f-2',
              name: 'Tennis Court A',
              venue_id: 'v-1',
              is_bookable: true,
              default_duration_minutes: 60,
              sport: { name: 'Tennis' },
            },
          ],
        },
      ];

      const mockBookings: RawBookingReportItem[] = [
        {
          id: 'b-1',
          booking_reference: 'SPH-001',
          customer_user_id: 'u-1',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-10',
          start_time: '10:00',
          end_time: '12:00',
          duration_minutes: 120,
          status: 'CONFIRMED',
          subtotal: 4000,
          total_amount: 4000,
          currency: 'LKR',
          created_at: '2026-10-01',
        },
      ];

      const mockPayments: RawPaymentReportItem[] = [
        {
          id: 'p-1',
          organization_id: 'org-1',
          booking_id: 'b-1',
          customer_user_id: 'u-1',
          amount: 4000,
          refunded_amount: 0,
          currency: 'LKR',
          payment_method: 'CARD',
          status: 'SUCCESS',
          created_at: '2026-10-01',
        },
      ];

      const facilityMetrics = computeFacilityPerformance(mockVenues, mockBookings, mockPayments);
      expect(facilityMetrics.length).toBe(2);

      const court1 = facilityMetrics.find((f) => f.facilityId === 'f-1');
      expect(court1?.totalBookings).toBe(1);
      expect(court1?.totalHours).toBe(2.0);
      expect(court1?.grossRevenue).toBe(4000);
      expect(court1?.sportName).toBe('Badminton');

      const venueMetrics = computeVenuePerformance(mockVenues, facilityMetrics);
      expect(venueMetrics.length).toBe(1);
      expect(venueMetrics[0].totalBookings).toBe(1);
      expect(venueMetrics[0].grossRevenue).toBe(4000);
    });
  });

  // ==========================================================================
  // 5. Customer Analytics & Cohorts
  // ==========================================================================
  describe('Customer Analytics', () => {
    it('distinguishes new vs returning customers and ranks top spenders', () => {
      const mockBookings: RawBookingReportItem[] = [
        {
          id: 'b-1',
          booking_reference: 'SPH-001',
          customer_user_id: 'cust-1',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-05',
          start_time: '10:00',
          end_time: '11:00',
          duration_minutes: 60,
          status: 'CONFIRMED',
          subtotal: 2500,
          total_amount: 2500,
          currency: 'LKR',
          created_at: '2026-10-01',
          customer: { full_name: 'Alice Silva' },
        },
        {
          id: 'b-2',
          booking_reference: 'SPH-002',
          customer_user_id: 'cust-1',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-10',
          start_time: '10:00',
          end_time: '11:00',
          duration_minutes: 60,
          status: 'CONFIRMED',
          subtotal: 2500,
          total_amount: 2500,
          currency: 'LKR',
          created_at: '2026-10-05',
          customer: { full_name: 'Alice Silva' },
        },
        {
          id: 'b-3',
          booking_reference: 'SPH-003',
          customer_user_id: 'cust-2',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-12',
          start_time: '14:00',
          end_time: '15:00',
          duration_minutes: 60,
          status: 'CONFIRMED',
          subtotal: 1500,
          total_amount: 1500,
          currency: 'LKR',
          created_at: '2026-10-06',
          customer: { full_name: 'Bob Perera' },
        },
      ];

      const customerMetrics = computeCustomerAnalytics(mockBookings);
      expect(customerMetrics.totalUniqueCustomers).toBe(2);
      expect(customerMetrics.returningCustomers).toBe(1); // Alice (2 bookings)
      expect(customerMetrics.newCustomers).toBe(1); // Bob (1 booking)
      expect(customerMetrics.topCustomers[0].customerId).toBe('cust-1');
      expect(customerMetrics.topCustomers[0].totalSpent).toBe(5000);
    });
  });

  // ==========================================================================
  // 6. Time Series & Peak Hours
  // ==========================================================================
  describe('Time Series & Peak Hours', () => {
    it('generates zero-filled continuous daily series for date range', () => {
      const mockBookings: RawBookingReportItem[] = [
        {
          id: 'b-1',
          booking_reference: 'SPH-001',
          customer_user_id: 'c-1',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-02',
          start_time: '18:00',
          end_time: '19:00',
          duration_minutes: 60,
          status: 'CONFIRMED',
          subtotal: 2000,
          total_amount: 2000,
          currency: 'LKR',
          created_at: '2026-10-02T18:00:00Z',
        },
      ];

      const series = computeTimeSeriesTrends(mockBookings, [], '2026-10-01', '2026-10-03');
      expect(series.length).toBe(3);
      expect(series[0].date).toBe('2026-10-01');
      expect(series[0].bookingsCount).toBe(0);
      expect(series[1].date).toBe('2026-10-02');
      expect(series[1].bookingsCount).toBe(1);
    });

    it('computes 24-hour peak hours distribution', () => {
      const mockBookings: RawBookingReportItem[] = [
        {
          id: 'b-1',
          booking_reference: 'SPH-001',
          customer_user_id: 'c-1',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-02',
          start_time: '18:00:00',
          end_time: '19:00:00',
          duration_minutes: 60,
          status: 'CONFIRMED',
          subtotal: 2000,
          total_amount: 2000,
          currency: 'LKR',
          created_at: '2026-10-02',
        },
        {
          id: 'b-2',
          booking_reference: 'SPH-002',
          customer_user_id: 'c-2',
          organization_id: 'org-1',
          venue_id: 'v-1',
          facility_id: 'f-1',
          sport_id: 's-1',
          booking_date: '2026-10-02',
          start_time: '18:30:00',
          end_time: '19:30:00',
          duration_minutes: 60,
          status: 'CONFIRMED',
          subtotal: 2000,
          total_amount: 2000,
          currency: 'LKR',
          created_at: '2026-10-02',
        },
      ];

      const peak = computePeakHours(mockBookings);
      expect(peak.length).toBe(24);
      const hour18 = peak.find((h) => h.hour === 18);
      expect(hour18?.bookingsCount).toBe(2);
      expect(hour18?.percentage).toBe(100);
    });
  });

  // ==========================================================================
  // 7. CSV Export Sanitization
  // ==========================================================================
  describe('CSV Export Generation', () => {
    it('escapes quotes and prevents formula injection in CSV output', () => {
      const mockReport: ExecutiveSummaryReport = {
        organizationId: 'org-1',
        organizationName: '=HYPERLINK("http://evil.com")',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        dateRange: { startDate: '2026-10-01', endDate: '2026-10-31', preset: 'this_month' },
        bookingOverview: {
          totalBookings: 10,
          confirmedBookings: 8,
          cancelledBookings: 2,
          activeHolds: 0,
          completedBookings: 8,
          walkInBookings: 1,
          cancellationRate: 20.0,
          totalHoursBooked: 10,
          averageDurationMinutes: 60,
        },
        revenueOverview: {
          grossBookingAmount: 20000,
          successfulPayments: 18000,
          pendingPayments: 2000,
          failedPayments: 0,
          totalRefundedAmount: 1000,
          netRevenue: 17000,
          currency: 'LKR',
          paymentMethodBreakdown: [{ method: 'CARD', count: 8, amount: 18000, percentage: 100 }],
          paymentStatusBreakdown: [{ status: 'SUCCESS', count: 8, amount: 18000 }],
        },
        venuePerformance: [],
        facilityPerformance: [],
        customerAnalytics: {
          totalUniqueCustomers: 5,
          newCustomers: 3,
          returningCustomers: 2,
          averageBookingsPerCustomer: 2,
          topCustomers: [],
        },
        bookingTrends: [],
        peakHours: [],
        recentActivity: [],
      };

      const csv = exportReportToCsv(mockReport, 'overview');
      expect(csv).toContain('SportsHub Report');
      expect(csv).toContain('REVENUE OVERVIEW');
      expect(csv).toContain('17000'); // Net revenue
      // Formula injection is escaped with leading single quote
      expect(csv).toContain(`'=HYPERLINK`);
    });
  });
});
