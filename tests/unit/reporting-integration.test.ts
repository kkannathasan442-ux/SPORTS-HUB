import { describe, it, expect } from 'vitest';
import { generateExecutiveSummaryReport } from '../../apps/web/src/lib/reports/analytics-engine';
import { exportReportToCsv } from '../../apps/web/src/lib/reports/export';

describe('STEP 9 — Reporting Service Integration Tests', () => {
  const orgId = '550e8400-e29b-41d4-a716-446655440001';

  const mockSupabase: any = {
    from: (table: string) => {
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { name: 'Metro Badminton Club', currency: 'LKR' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'bookings') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: async () => ({
                    data: [
                      {
                        id: 'b-1',
                        booking_reference: 'SPH-001',
                        customer_user_id: 'cust-1',
                        organization_id: orgId,
                        venue_id: 'v-1',
                        facility_id: 'f-1',
                        sport_id: 's-1',
                        booking_date: '2026-10-10',
                        start_time: '09:00',
                        end_time: '10:00',
                        duration_minutes: 60,
                        status: 'CONFIRMED',
                        subtotal: 2000,
                        total_amount: 2000,
                        currency: 'LKR',
                        created_at: '2026-10-01T10:00:00Z',
                        venue: { name: 'Metro Arena', city: 'Colombo' },
                        facility: { name: 'Court 1', sport: { name: 'Badminton' } },
                        customer: { full_name: 'Alice Silva', phone: '+94771112233' },
                      },
                      {
                        id: 'b-2',
                        booking_reference: 'SPH-002',
                        customer_user_id: 'cust-2',
                        organization_id: orgId,
                        venue_id: 'v-1',
                        facility_id: 'f-1',
                        sport_id: 's-1',
                        booking_date: '2026-10-12',
                        start_time: '18:00',
                        end_time: '19:30',
                        duration_minutes: 90,
                        status: 'CONFIRMED',
                        subtotal: 3000,
                        total_amount: 3000,
                        currency: 'LKR',
                        created_at: '2026-10-02T10:00:00Z',
                        venue: { name: 'Metro Arena', city: 'Colombo' },
                        facility: { name: 'Court 1', sport: { name: 'Badminton' } },
                        customer: { full_name: 'Bob Perera', phone: '+94774445566' },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'payment_transactions') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: async () => ({
                    data: [
                      {
                        id: 'p-1',
                        organization_id: orgId,
                        booking_id: 'b-1',
                        customer_user_id: 'cust-1',
                        amount: 2000,
                        refunded_amount: 0,
                        currency: 'LKR',
                        payment_method: 'STRIPE',
                        status: 'SUCCESS',
                        created_at: '2026-10-01T10:05:00Z',
                      },
                      {
                        id: 'p-2',
                        organization_id: orgId,
                        booking_id: 'b-2',
                        customer_user_id: 'cust-2',
                        amount: 3000,
                        refunded_amount: 0,
                        currency: 'LKR',
                        payment_method: 'CASH',
                        status: 'SUCCESS',
                        created_at: '2026-10-02T10:05:00Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'refund_records') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: async () => ({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'venues') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [
                  {
                    id: 'v-1',
                    name: 'Metro Arena',
                    city: 'Colombo',
                    facilities: [
                      {
                        id: 'f-1',
                        name: 'Court 1',
                        venue_id: 'v-1',
                        is_bookable: true,
                        default_duration_minutes: 60,
                        sport: { name: 'Badminton' },
                      },
                    ],
                    operating_hours: [],
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      return {} as any;
    },
  };

  it('generates a complete executive summary report across all analytical dimensions', async () => {
    const report = await generateExecutiveSummaryReport(mockSupabase, {
      organizationId: orgId,
      timeRangePreset: 'this_month',
    });

    expect(report.organizationId).toBe(orgId);
    expect(report.organizationName).toBe('Metro Badminton Club');
    expect(report.currency).toBe('LKR');

    // 1. Bookings Overview
    expect(report.bookingOverview.totalBookings).toBe(2);
    expect(report.bookingOverview.confirmedBookings).toBe(2);
    expect(report.bookingOverview.totalHoursBooked).toBe(2.5); // 150 mins / 60 = 2.5 hrs

    // 2. Revenue Overview
    expect(report.revenueOverview.grossBookingAmount).toBe(5000);
    expect(report.revenueOverview.successfulPayments).toBe(5000);
    expect(report.revenueOverview.netRevenue).toBe(5000);
    expect(report.revenueOverview.paymentMethodBreakdown.length).toBe(2);

    // 3. Facility Performance
    expect(report.facilityPerformance.length).toBe(1);
    expect(report.facilityPerformance[0].facilityName).toBe('Court 1');
    expect(report.facilityPerformance[0].totalHours).toBe(2.5);
    expect(report.facilityPerformance[0].grossRevenue).toBe(5000);

    // 4. Customer Cohorts
    expect(report.customerAnalytics.totalUniqueCustomers).toBe(2);
    expect(report.customerAnalytics.newCustomers).toBe(2);

    // 5. CSV Export Generation
    const csv = exportReportToCsv(report, 'overview');
    expect(csv).toContain('Metro Badminton Club');
    expect(csv).toContain('Court 1');
    expect(csv).toContain('5000');
  });
});
