import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/authorization';
import { getCustomerBookingReceipt } from '@/lib/customer/customer-service';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Printer,
  ChevronLeft,
  CheckCircle2,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Booking Receipt — SportsHub',
};

interface ReceiptPageProps {
  params: {
    bookingId: string;
  };
}

export default async function BookingReceiptPage({ params }: ReceiptPageProps) {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch {
    redirect('/login?error=auth_required');
  }

  const { user } = authContext;
  const receipt = await getCustomerBookingReceipt(user.id, params.bookingId);

  if (!receipt) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-100/70 py-8 print:bg-white print:py-0">
      <Container className="max-w-2xl mx-auto space-y-6">
        {/* Navigation & Action Bar (Hidden during printing) */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/customer/bookings/${receipt.bookingId}`}
            className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Booking Details
          </Link>

          <Button
            size="sm"
            onClick={() => {
              if (typeof window !== 'undefined') window.print();
            }}
            className="gap-2 text-xs font-semibold shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </Button>
        </div>

        {/* Printable Receipt Paper Container */}
        <Card className="p-8 sm:p-10 border-slate-200/80 shadow-md bg-white print:shadow-none print:border-none print:p-0 space-y-6">
          {/* Header Banner */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <div className="text-xl font-black tracking-tight text-sports-navy flex items-center gap-2">
                <span>SportsHub</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sports-navy/10 text-sports-navy">
                  Verified Booking
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Official Reservation Voucher & Payment Receipt
              </div>
            </div>

            <div className="text-right text-xs">
              <div className="font-mono font-bold text-slate-900 text-sm">{receipt.reference}</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Issued: {new Date(receipt.issuedAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Business & Customer Information */}
          <div className="grid grid-cols-2 gap-6 text-xs border-b border-slate-100 pb-6">
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Issued By (Facility Host)
              </span>
              <div className="font-bold text-slate-900 text-sm">{receipt.organizationName}</div>
              <div className="text-slate-600 font-medium mt-0.5">{receipt.venueName}</div>
              <div className="text-slate-500 text-[11px] mt-0.5">{receipt.venueAddress}</div>
              {receipt.organizationPhone && (
                <div className="text-slate-500 text-[11px] mt-0.5">Phone: {receipt.organizationPhone}</div>
              )}
            </div>

            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Billed To (Customer)
              </span>
              <div className="font-bold text-slate-900 text-sm">{receipt.customerName}</div>
              <div className="text-slate-600 font-medium mt-0.5">{receipt.customerEmail}</div>
              {receipt.customerPhone && (
                <div className="text-slate-500 text-[11px] mt-0.5">Phone: {receipt.customerPhone}</div>
              )}
            </div>
          </div>

          {/* Reservation Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Reservation Details
            </h3>
            <div className="rounded-xl border border-slate-200/80 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Date & Slot</th>
                    <th className="py-2.5 px-3 text-right">Duration</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{receipt.facilityName}</div>
                      <div className="text-[11px] text-slate-400">{receipt.facilityType}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <div>{receipt.bookingDate}</div>
                      <div className="text-[11px] text-slate-400">
                        {receipt.startTime.slice(0, 5)} - {receipt.endTime.slice(0, 5)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {receipt.durationMinutes} mins
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {receipt.currency} {receipt.totalPrice.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-900 uppercase">
                  Payment Status: {receipt.paymentStatus}
                </span>
              </div>
              {receipt.paymentReference && (
                <div className="text-slate-500 text-[11px] font-mono">
                  Txn Ref: {receipt.paymentReference}
                </div>
              )}
              {receipt.paymentMethod && (
                <div className="text-slate-500 text-[11px]">
                  Method: {receipt.paymentMethod}
                </div>
              )}
            </div>

            <div className="text-right sm:border-l sm:border-slate-200 sm:pl-6">
              <span className="text-slate-400 text-[11px] block uppercase font-semibold">
                Total Paid
              </span>
              <span className="text-xl font-black text-sports-navy">
                {receipt.currency} {receipt.totalPrice.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Footer Notes */}
          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed text-center space-y-1">
            <p>
              Please present this voucher or show your booking reference ({receipt.reference}) at the reception desk prior to playing.
            </p>
            <p className="text-[10px] text-slate-400">
              For cancellations or rescheduling, refer to the facility terms in your SportsHub portal.
            </p>
          </div>
        </Card>
      </Container>
    </div>
  );
}
