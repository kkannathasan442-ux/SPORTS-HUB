'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PaymentCheckoutModal } from './PaymentCheckoutModal';
import { formatCurrency } from '@sportshub/shared';
import type { BookingWithDetails, PaymentTransaction } from '@sportshub/types';

interface CustomerPayNowSectionProps {
  booking: BookingWithDetails;
  payment?: PaymentTransaction | null;
}

export function CustomerPayNowSection({ booking, payment }: CustomerPayNowSectionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  if (payment && (payment.status === 'SUCCESS' || payment.status === 'PARTIALLY_REFUNDED')) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-900 flex items-center gap-2">
              <span>Payment Completed</span>
              <span className="font-mono text-[11px] font-normal text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                Ref: {payment.provider_reference || payment.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              Paid via {payment.payment_method} on {new Date(payment.completed_at || payment.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="text-right sm:text-right w-full sm:w-auto">
          <span className="text-sm font-black text-emerald-800">
            {formatCurrency(payment.amount, payment.currency)}
          </span>
        </div>
      </div>
    );
  }

  const isPayable =
    booking.status === 'CONFIRMED' ||
    (booking.status === 'HOLD' &&
      (!booking.hold_expires_at || new Date(booking.hold_expires_at) > new Date()));

  if (!isPayable) {
    return null;
  }

  return (
    <>
      <div className="bg-sports-navy/5 border border-sports-primary/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sports-navy text-white flex items-center justify-center shrink-0 shadow-xs">
            <CreditCard className="w-5 h-5 text-sports-accent" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Payment Due
            </div>
            <div className="text-base font-black text-sports-navy">
              {formatCurrency(booking.total_amount, booking.currency)}
            </div>
          </div>
        </div>

        <Button
          id="pay-now-booking-button"
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto bg-sports-navy hover:bg-slate-800 text-white font-bold rounded-xl px-5 py-2.5 shadow-md flex items-center justify-center gap-2"
        >
          <span>Pay Online Now</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <PaymentCheckoutModal
        booking={booking}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
