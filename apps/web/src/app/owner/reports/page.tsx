'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Ticket,
  Users,
  Activity,
  Calendar,
  Download,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@sportshub/shared';
import type {
  ExecutiveSummaryReport,
  TimeRangePreset,
} from '@sportshub/types';

export default function OwnerReportsPage() {
  const [report, setReport] = useState<ExecutiveSummaryReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [preset, setPreset] = useState<TimeRangePreset>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'bookings' | 'revenue' | 'facilities' | 'customers'
  >('overview');

  const fetchReport = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);

    try {
      let url = `/api/reports/overview?timeRangePreset=${preset}`;
      if (preset === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setReport(json.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let url = `/api/reports/export?reportType=${activeTab}&timeRangePreset=${preset}`;
      if (preset === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      window.location.href = url;
    } catch (err) {
      console.warn('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const currency = report?.currency || 'LKR';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sports-navy text-white rounded-2xl shadow-xs">
            <BarChart3 className="w-6 h-6 text-sports-accent" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-sports-navy">Reports & Business Intelligence</h1>
            <p className="text-xs text-slate-500">
              Operational KPIs, revenue reconciliation, facility utilization, and customer trends.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchReport(true)}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-sports-navy hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
            title="Refresh analytics"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>

          <Button
            onClick={handleExport}
            disabled={isExporting || isLoading}
            variant="outline"
            size="sm"
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Date Range Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 mr-1" />
          {[
            { label: 'Today', val: 'today' },
            { label: 'This Week', val: 'this_week' },
            { label: 'This Month', val: 'this_month' },
            { label: 'Previous Month', val: 'previous_month' },
            { label: 'Last 90 Days', val: 'last_90_days' },
            { label: 'This Year', val: 'this_year' },
            { label: 'Custom', val: 'custom' },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => setPreset(item.val as TimeRangePreset)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                preset === item.val
                  ? 'bg-sports-navy text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs"
            />
            <Button size="sm" onClick={() => fetchReport(false)} className="text-xs h-7">
              Apply
            </Button>
          </div>
        )}

        {report && (
          <span className="text-xs text-slate-400 font-mono">
            {report.dateRange.startDate} – {report.dateRange.endDate} ({report.timezone})
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-xs text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-sports-accent mx-auto" />
          <p className="font-semibold text-slate-600">Calculating analytics & financial totals...</p>
        </div>
      ) : !report ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          No report data available for the selected criteria.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4 bg-white border-slate-200 shadow-xs rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Net Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-sports-navy mt-1">
                {formatCurrency(report.revenueOverview.netRevenue, currency)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Gross: {formatCurrency(report.revenueOverview.successfulPayments, currency)}
              </div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-xs rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Bookings</span>
                <Ticket className="w-4 h-4 text-sports-accent" />
              </div>
              <div className="text-2xl font-black text-sports-navy mt-1">
                {report.bookingOverview.totalBookings}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                {report.bookingOverview.confirmedBookings} Confirmed
              </div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-xs rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Hours Booked</span>
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-sports-navy mt-1">
                {report.bookingOverview.totalHoursBooked} hrs
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Avg {report.bookingOverview.averageDurationMinutes}m / booking
              </div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-xs rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Cancellation Rate</span>
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-sports-navy mt-1">
                {report.bookingOverview.cancellationRate}%
              </div>
              <div className="text-[11px] text-rose-600 font-medium mt-1">
                {report.bookingOverview.cancelledBookings} cancelled
              </div>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-xs rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Unique Customers</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-sports-navy mt-1">
                {report.customerAnalytics.totalUniqueCustomers}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {report.customerAnalytics.newCustomers} new · {report.customerAnalytics.returningCustomers} returning
              </div>
            </Card>
          </div>

          {/* Section Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            {[
              { id: 'overview', label: 'Executive Summary', icon: TrendingUp },
              { id: 'bookings', label: 'Bookings & Peak Hours', icon: Ticket },
              { id: 'revenue', label: 'Revenue & Financials', icon: DollarSign },
              { id: 'facilities', label: 'Facilities Performance', icon: MapPin },
              { id: 'customers', label: 'Customer Cohorts', icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap',
                    activeTab === tab.id
                      ? 'bg-sports-navy text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab 1: Executive Overview */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Trend Chart (Visual Sparkline Representation) */}
              <Card className="p-6 bg-white border-slate-200 shadow-xs rounded-2xl lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-sports-navy">Booking & Revenue Daily Trend</h3>
                    <p className="text-xs text-slate-400">Activity distribution over selected period</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {report.bookingTrends.length} Days Tracked
                  </Badge>
                </div>

                <div className="h-48 flex items-end gap-1 pt-6 pb-2 overflow-x-auto">
                  {report.bookingTrends.map((d, i) => {
                    const maxB = Math.max(1, ...report.bookingTrends.map((x) => x.bookingsCount));
                    const heightPct = Math.max(8, Math.round((d.bookingsCount / maxB) * 100));

                    return (
                      <div
                        key={d.date}
                        className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group relative"
                      >
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={cn(
                            'w-full rounded-t-sm transition-all',
                            d.bookingsCount > 0
                              ? 'bg-sports-navy group-hover:bg-sports-accent'
                              : 'bg-slate-100'
                          )}
                        />
                        <span className="text-[9px] text-slate-400 font-mono hidden sm:block">
                          {i % 3 === 0 ? d.label : ''}
                        </span>

                        {/* Tooltip on Hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg z-10 pointer-events-none whitespace-nowrap">
                          <span className="font-bold">{d.date}</span>
                          <span>Bookings: {d.bookingsCount}</span>
                          <span>Revenue: {formatCurrency(d.revenue, currency)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Payment Methods Breakdown */}
              <Card className="p-6 bg-white border-slate-200 shadow-xs rounded-2xl space-y-4">
                <h3 className="text-sm font-extrabold text-sports-navy">Payment Methods</h3>
                <div className="space-y-3">
                  {report.revenueOverview.paymentMethodBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No successful payments in period</p>
                  ) : (
                    report.revenueOverview.paymentMethodBreakdown.map((m) => (
                      <div key={m.method} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">{m.method}</span>
                          <span className="font-mono text-slate-900 font-bold">
                            {formatCurrency(m.amount, currency)} ({m.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${m.percentage}%` }}
                            className="bg-emerald-500 h-full rounded-full"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                  <span>Refunds Subtracted:</span>
                  <span className="font-bold text-rose-600">
                    -{formatCurrency(report.revenueOverview.totalRefundedAmount, currency)}
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* Tab 2: Bookings & Peak Hours */}
          {activeTab === 'bookings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Peak Hours Histogram */}
              <Card className="p-6 bg-white border-slate-200 shadow-xs rounded-2xl space-y-4">
                <h3 className="text-sm font-extrabold text-sports-navy">Peak Booking Hours Distribution</h3>
                <p className="text-xs text-slate-400">Court demand by hour of the day (00:00 - 23:00)</p>

                <div className="space-y-1.5 pt-2">
                  {report.peakHours
                    .filter((h) => h.hour >= 6 && h.hour <= 23) // Focus on operating hours
                    .map((h) => (
                      <div key={h.hour} className="flex items-center gap-3 text-xs">
                        <span className="w-12 font-mono text-slate-500 font-semibold">{h.label}</span>
                        <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, h.percentage * 3)}%` }}
                            className="bg-sports-navy h-full rounded-full"
                          />
                        </div>
                        <span className="w-16 text-right font-mono text-slate-700 font-bold">
                          {h.bookingsCount} slots
                        </span>
                      </div>
                    ))}
                </div>
              </Card>

              {/* Booking Breakdown Table */}
              <Card className="p-6 bg-white border-slate-200 shadow-xs rounded-2xl space-y-4">
                <h3 className="text-sm font-extrabold text-sports-navy">Booking Status Breakdown</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Confirmed Reservations', count: report.bookingOverview.confirmedBookings, color: 'bg-emerald-100 text-emerald-800' },
                    { label: 'Completed Play Sessions', count: report.bookingOverview.completedBookings, color: 'bg-blue-100 text-blue-800' },
                    { label: 'Active Holds', count: report.bookingOverview.activeHolds, color: 'bg-amber-100 text-amber-800' },
                    { label: 'Walk-In Desk Bookings', count: report.bookingOverview.walkInBookings, color: 'bg-purple-100 text-purple-800' },
                    { label: 'Cancelled & Expired', count: report.bookingOverview.cancelledBookings, color: 'bg-rose-100 text-rose-800' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-700">{item.label}</span>
                      <span className={cn('px-2.5 py-0.5 rounded-full font-bold text-xs', item.color)}>
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Tab 3: Revenue & Financials */}
          {activeTab === 'revenue' && (
            <Card className="p-6 bg-white border-slate-200 shadow-xs rounded-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-sports-navy">Financial Ledger & Revenue Summary</h3>
                  <p className="text-xs text-slate-500">Verified transaction receipts and net revenue reconciliation</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                  Net: {formatCurrency(report.revenueOverview.netRevenue, currency)}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Successful Payments</span>
                  <div className="text-xl font-bold text-emerald-600 mt-1">
                    {formatCurrency(report.revenueOverview.successfulPayments, currency)}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Pending Payments</span>
                  <div className="text-xl font-bold text-amber-600 mt-1">
                    {formatCurrency(report.revenueOverview.pendingPayments, currency)}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Failed Payments</span>
                  <div className="text-xl font-bold text-rose-600 mt-1">
                    {formatCurrency(report.revenueOverview.failedPayments, currency)}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Refunds Processed</span>
                  <div className="text-xl font-bold text-purple-600 mt-1">
                    -{formatCurrency(report.revenueOverview.totalRefundedAmount, currency)}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tab 4: Facilities Performance */}
          {activeTab === 'facilities' && (
            <Card className="p-6 bg-white border-slate-200 shadow-xs rounded-2xl space-y-4">
              <h3 className="text-base font-extrabold text-sports-navy">Court & Facility Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px]">
                      <th className="pb-3">Facility Name</th>
                      <th className="pb-3">Venue</th>
                      <th className="pb-3">Sport</th>
                      <th className="pb-3 text-right">Bookings</th>
                      <th className="pb-3 text-right">Hours</th>
                      <th className="pb-3 text-right">Revenue</th>
                      <th className="pb-3 text-right">Est. Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.facilityPerformance.map((f) => (
                      <tr key={f.facilityId} className="hover:bg-slate-50/80">
                        <td className="py-3.5 font-bold text-slate-900">{f.facilityName}</td>
                        <td className="py-3.5 text-slate-600">{f.venueName}</td>
                        <td className="py-3.5 text-slate-500">{f.sportName}</td>
                        <td className="py-3.5 text-right font-mono font-semibold">{f.totalBookings}</td>
                        <td className="py-3.5 text-right font-mono text-slate-600">{f.totalHours} hrs</td>
                        <td className="py-3.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(f.grossRevenue, currency)}
                        </td>
                        <td className="py-3.5 text-right font-mono text-emerald-600 font-bold">
                          {f.utilizationRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Tab 5: Customer Analytics */}
          {activeTab === 'customers' && (
            <Card className="p-6 bg-white border-slate-200 shadow-xs rounded-2xl space-y-4">
              <h3 className="text-base font-extrabold text-sports-navy">Top Active Customers</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px]">
                      <th className="pb-3">Customer Name</th>
                      <th className="pb-3 text-right">Bookings Count</th>
                      <th className="pb-3 text-right">Total Spent</th>
                      <th className="pb-3 text-right">Last Booking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.customerAnalytics.topCustomers.map((c) => (
                      <tr key={c.customerId} className="hover:bg-slate-50/80">
                        <td className="py-3.5 font-bold text-slate-900">{c.customerName}</td>
                        <td className="py-3.5 text-right font-mono font-semibold">{c.bookingsCount}</td>
                        <td className="py-3.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(c.totalSpent, currency)}
                        </td>
                        <td className="py-3.5 text-right font-mono text-slate-500">{c.lastBookingDate || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
