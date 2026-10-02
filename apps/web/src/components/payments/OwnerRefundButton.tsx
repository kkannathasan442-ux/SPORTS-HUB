'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@sportshub/shared';

interface OwnerRefundButtonProps {
  paymentId: string;
  totalAmount: number;
  refundedAmount: number;
  currency: string;
  customerName?: string;
  bookingRef?: string;
}

export function OwnerRefundButton({
  paymentId,
  totalAmount,
  refundedAmount,
  currency,
  customerName,
  bookingRef,
}: OwnerRefundButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(
    Math.max(0, totalAmount - (refundedAmount || 0))
  );
  const [reason, setReason] = useState('Customer cancellation / requested refund');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const availableRefundable = Math.max(0, totalAmount - (refundedAmount || 0));

  if (availableRefundable <= 0) {
    return <span className="text-[11px] text-purple-700 font-semibold">Fully Refunded</span>;
  }

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentTransactionId: paymentId,
          amount: Number(refundAmount),
          reason,
          idempotencyKey: `rfd_owner_${paymentId}_${Date.now()}`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to process refund');
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Refund failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-[11px] font-bold text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 flex items-center gap-1"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Refund</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 text-left">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">Issue Payment Refund</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="text-base font-bold text-slate-900">Refund Processed!</h4>
                <p className="text-xs text-slate-500">
                  {formatCurrency(refundAmount, currency)} has been successfully refunded.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRefund} className="space-y-4">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking Ref:</span>
                    <span className="font-mono font-bold text-slate-900">{bookingRef || 'N/A'}</span>
                  </div>
                  {customerName && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Customer:</span>
                      <span className="font-semibold text-slate-800">{customerName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Original Total:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(totalAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Available Refundable:</span>
                    <span>{formatCurrency(availableRefundable, currency)}</span>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="refundAmount" className="text-xs font-bold text-slate-700">Refund Amount ({currency})</label>
                  <input
                    id="refundAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={availableRefundable}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="refundReason" className="text-xs font-bold text-slate-700">Reason for Refund</label>
                  <input
                    id="refundReason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                    className="w-full font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || refundAmount <= 0 || refundAmount > availableRefundable}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      `Confirm Refund (${formatCurrency(refundAmount, currency)})`
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
