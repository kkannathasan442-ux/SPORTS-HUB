import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOwnerPaymentLedger, getOwnerFinancialSummary } from '@/lib/payments/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { OwnerRefundButton } from '@/components/payments/OwnerRefundButton';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock3,
  RotateCcw,
  DollarSign,
  TrendingUp,
  Receipt,
  Download,
} from 'lucide-react';
import { formatCurrency } from '@sportshub/shared';
import type { PaymentStatus, PaymentMethod } from '@sportshub/types';

interface OwnerPaymentsPageProps {
  searchParams?: {
    venueId?: string;
    status?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default async function OwnerPaymentsPage({ searchParams }: OwnerPaymentsPageProps) {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    redirect('/login?redirect=/owner/payments');
  }

  const org = context.activeOrganization;
  const isAuthorized =
    context.role && ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTIONIST'].includes(context.role);

  if (!isAuthorized) {
    redirect('/owner?error=unauthorized');
  }

  const supabase = await createSupabaseServerClient();

  // Fetch all venues for filter dropdown
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('organization_id', org.id);

  // Fetch financial summary and ledger
  const summary = await getOwnerFinancialSummary(supabase, org.id);

  const ledgerResult = await getOwnerPaymentLedger(supabase, org.id, {
    venueId: searchParams?.venueId,
    status: searchParams?.status as PaymentStatus | undefined,
    paymentMethod: searchParams?.paymentMethod as PaymentMethod | undefined,
    startDate: searchParams?.startDate,
    endDate: searchParams?.endDate,
    pageSize: 50,
  });

  const transactions = ledgerResult.payments;

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            SUCCESS
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold flex items-center gap-1">
            <Clock3 className="w-3 h-3" />
            PENDING
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            FAILED
          </Badge>
        );
      case 'REFUNDED':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            REFUNDED
          </Badge>
        );
      case 'PARTIALLY_REFUNDED':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-bold flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            PARTIAL REFUND
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-bold">
            CANCELLED
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financials & Transaction Ledger"
        description="Authoritative real-time payment transactions, net revenue, receipts, and refund management across your venues."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Net Revenue</span>
            <span className="text-2xl font-black text-sports-navy mt-1 block">
              {formatCurrency(summary.totalRevenue, summary.currency)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">Successful Payments</span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block">
              {summary.totalSuccessfulPayments}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">Pending Payments</span>
            <span className="text-2xl font-black text-amber-700 mt-1 block">
              {summary.totalPendingPayments}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock3 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider block">Total Refunded</span>
            <span className="text-2xl font-black text-purple-700 mt-1 block">
              {formatCurrency(summary.totalRefundedAmount, summary.currency)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 bg-white rounded-2xl border-slate-200/80 shadow-xs">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="venueId" className="block text-xs font-semibold text-slate-500 mb-1">Venue</label>
            <select
              id="venueId"
              name="venueId"
              defaultValue={searchParams?.venueId || ''}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none"
            >
              <option value="">All Venues</option>
              {(venues || []).map((v: { id: string; name: string }) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-xs font-semibold text-slate-500 mb-1">Payment Status</label>
            <select
              id="status"
              name="status"
              defaultValue={searchParams?.status || ''}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
              <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
            </select>
          </div>

          <div>
            <label htmlFor="paymentMethod" className="block text-xs font-semibold text-slate-500 mb-1">Method</label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue={searchParams?.paymentMethod || ''}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none"
            >
              <option value="">All Methods</option>
              <option value="CARD">Card</option>
              <option value="ONLINE_BANKING">Online Banking</option>
              <option value="WALLET">Wallet</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" className="w-full bg-sports-navy text-white font-semibold py-2.5 px-4 shadow-xs">
              Apply Filters
            </Button>
            <Link href="/owner/payments">
              <Button type="button" variant="outline" size="sm" className="py-2.5 px-3">
                Reset
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      {/* Transaction Ledger Table */}
      <Card className="bg-white rounded-2xl border-slate-200/80 shadow-xs overflow-hidden">
        {transactions.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No payment transactions found</p>
            <p className="text-xs text-slate-500 mt-0.5">Transactions will appear here as customers complete payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider">
                  <th className="p-4">Transaction / Provider Ref</th>
                  <th className="p-4">Booking & Facility</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {transactions.map((tx) => {
                  const booking = tx.booking;
                  const canRefund = tx.status === 'SUCCESS' || tx.status === 'PARTIALLY_REFUNDED';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="font-mono font-bold text-slate-900">
                          {tx.provider_reference || `TXN-${tx.id.slice(0, 8).toUpperCase()}`}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Provider: {tx.provider}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">
                          {booking?.facility?.name || 'Facility'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Ref: <span className="font-mono font-semibold">{booking?.booking_reference || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-900">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                          {tx.payment_method}
                        </span>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-black text-slate-900 text-sm">
                          {formatCurrency(tx.amount, tx.currency)}
                        </div>
                        {Number(tx.refunded_amount || 0) > 0 && (
                          <div className="text-[10px] text-purple-700 font-bold">
                            Refunded: {formatCurrency(tx.refunded_amount, tx.currency)}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        {canRefund ? (
                          <OwnerRefundButton
                            paymentId={tx.id}
                            totalAmount={Number(tx.amount)}
                            refundedAmount={Number(tx.refunded_amount || 0)}
                            currency={tx.currency}
                            bookingRef={booking?.booking_reference}
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
