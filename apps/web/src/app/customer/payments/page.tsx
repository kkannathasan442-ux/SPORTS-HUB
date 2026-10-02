import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCustomerPaymentHistory } from '@/lib/payments/queries';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  CreditCard,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock3,
  RotateCcw,
  Receipt,
  ArrowUpRight,
} from 'lucide-react';
import { formatCurrency } from '@sportshub/shared';
import type { PaymentStatus } from '@sportshub/types';

interface CustomerPaymentsPageProps {
  searchParams?: {
    status?: string;
  };
}

export default async function CustomerPaymentsPage({ searchParams }: CustomerPaymentsPageProps) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=auth_required');
  }

  const activeStatus = searchParams?.status as PaymentStatus | undefined;
  const result = await getCustomerPaymentHistory(supabase, {
    status: activeStatus,
    pageSize: 50,
  });

  const payments = result.payments;

  // Calculate quick summary metrics
  const totalSpent = payments
    .filter((p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED')
    .reduce((sum, p) => sum + (Number(p.amount) - Number(p.refunded_amount || 0)), 0);

  const totalSuccessful = payments.filter((p) => p.status === 'SUCCESS').length;
  const totalRefunded = payments.filter((p) => p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED').length;

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
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Container className="py-8">
        <PageHeader
          title="Payment & Transaction History"
          description="Track all your digital court payments, receipts, and refund records."
          action={
            <Link href="/customer/bookings">
              <Button variant="outline" className="font-semibold shadow-xs">
                View My Bookings
              </Button>
            </Link>
          }
        />

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5 bg-white border-slate-200 shadow-xs rounded-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Net Spent</div>
            <div className="text-2xl font-black text-sports-navy mt-1">
              {formatCurrency(totalSpent, payments[0]?.currency || 'LKR')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Across all verified bookings</div>
          </Card>

          <Card className="p-5 bg-white border-slate-200 shadow-xs rounded-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Successful Payments</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{totalSuccessful}</div>
            <div className="text-[11px] text-slate-500 mt-1">Completed court transactions</div>
          </Card>

          <Card className="p-5 bg-white border-slate-200 shadow-xs rounded-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Refunds Processed</div>
            <div className="text-2xl font-black text-purple-600 mt-1">{totalRefunded}</div>
            <div className="text-[11px] text-slate-500 mt-1">Credited back transactions</div>
          </Card>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200">
          {[
            { key: '', label: 'All Transactions' },
            { key: 'SUCCESS', label: 'Successful' },
            { key: 'PENDING', label: 'Pending' },
            { key: 'FAILED', label: 'Failed' },
            { key: 'REFUNDED', label: 'Refunded' },
          ].map((tab) => {
            const isActive = (!activeStatus && tab.key === '') || activeStatus === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.key ? `/customer/payments?status=${tab.key}` : '/customer/payments'}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-sports-navy text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Transaction History List */}
        {payments.length === 0 ? (
          <Card className="py-16 text-center bg-white rounded-2xl border-slate-200 shadow-xs max-w-lg mx-auto">
            <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">No transactions recorded</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              You haven&apos;t made any payments yet. When you pay for court bookings, they will appear here.
            </p>
            <div className="mt-6">
              <Link href="/search">
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                  Find a Court & Book
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {payments.map((tx) => {
              const booking = tx.booking;

              return (
                <Card
                  key={tx.id}
                  className="p-6 rounded-2xl bg-white border-slate-200 hover:border-slate-300 transition-all shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                >
                  {/* Left: Info */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {tx.provider_reference || `TXN-${tx.id.slice(0, 8).toUpperCase()}`}
                      </span>
                      {getStatusBadge(tx.status)}
                      <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        Method: {tx.payment_method}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        Provider: {tx.provider}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        {booking?.facility?.name || 'Court Facility'}
                        {booking?.booking_reference && (
                          <span className="text-xs font-mono text-slate-500 font-normal">
                            (Ref: {booking.booking_reference})
                          </span>
                        )}
                      </h3>
                      {booking?.venue?.name && (
                        <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{booking.venue.name}</span>
                          {booking.venue.city && <span>· {booking.venue.city}</span>}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Date: {new Date(tx.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Time: {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {tx.failure_message && (
                        <div className="text-xs text-rose-600 font-medium">
                          Note: {tx.failure_message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount & Booking Link */}
                  <div className="flex flex-row md:flex-col items-end justify-between md:justify-center w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 gap-4">
                    <div className="text-left md:text-right">
                      <span className="text-xs text-slate-400 uppercase tracking-wider block">Transaction Amount</span>
                      <span className="text-xl font-black text-slate-900">
                        {formatCurrency(tx.amount, tx.currency)}
                      </span>
                      {Number(tx.refunded_amount || 0) > 0 && (
                        <span className="text-xs text-purple-700 font-semibold block">
                          Refunded: -{formatCurrency(tx.refunded_amount, tx.currency)}
                        </span>
                      )}
                    </div>

                    {booking && (
                      <Link href={`/customer/bookings/${booking.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-semibold text-xs flex items-center gap-1.5 border-slate-300"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Booking</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
