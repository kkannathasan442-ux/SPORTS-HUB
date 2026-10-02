'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  X,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@sportshub/shared';
import type { BookingWithDetails, PaymentTransaction } from '@sportshub/types';

interface PaymentCheckoutModalProps {
  booking: BookingWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (transaction: PaymentTransaction) => void;
}

export function PaymentCheckoutModal({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: PaymentCheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'ONLINE_BANKING' | 'WALLET'>('CARD');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('123');
  const [cardName, setCardName] = useState(booking.customer?.full_name || 'Cardholder Name');
  const [verificationToken, setVerificationToken] = useState('tok_valid_demo');

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'FORM' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('FORM');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedTx, setCompletedTx] = useState<PaymentTransaction | null>(null);

  if (!isOpen) return null;

  const handleSimulatePayment = async () => {
    setLoading(true);
    setStep('PROCESSING');
    setErrorMessage(null);

    try {
      // 1. Create payment transaction on server (server derives amount from booking)
      const createRes = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentMethod,
          idempotencyKey: `idem_ui_${booking.id}_${Date.now()}`,
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok || !createData.success || !createData.transaction) {
        throw new Error(createData.error?.message || 'Failed to initiate payment transaction');
      }

      const transaction = createData.transaction as PaymentTransaction;

      // If already success (e.g. idempotent retry)
      if (transaction.status === 'SUCCESS') {
        setCompletedTx(transaction);
        setStep('SUCCESS');
        onSuccess?.(transaction);
        return;
      }

      // 2. Call server verification endpoint with verification token
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentTransactionId: transaction.id,
          verificationToken,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success || !verifyData.transaction) {
        throw new Error(verifyData.error?.message || 'Payment verification failed');
      }

      const verifiedTx = verifyData.transaction as PaymentTransaction;
      setCompletedTx(verifiedTx);
      setStep('SUCCESS');
      onSuccess?.(verifiedTx);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment processing failed. Please try again.');
      setStep('ERROR');
    } finally {
      setLoading(false);
    }
  };

  const handleFillTestCard = (type: 'success' | 'declined') => {
    if (type === 'success') {
      setCardNumber('4242 •••• •••• 4242');
      setVerificationToken('tok_valid_demo');
      setErrorMessage(null);
    } else {
      setCardNumber('4000 •••• •••• 0002');
      setVerificationToken('tok_fail_declined');
      setErrorMessage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-sports-navy p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sports-accent text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure 256-Bit Encrypted Checkout</span>
          </div>
          <h2 className="text-xl font-black text-white">Complete Your Booking Payment</h2>
          <p className="text-xs text-slate-300 mt-1">
            Booking Ref: <span className="font-mono text-sports-accent font-bold">{booking.booking_reference}</span>
          </p>
        </div>

        <div className="p-6">
          {/* SUCCESS STATE */}
          {step === 'SUCCESS' && completedTx && (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Payment Successful!</h3>
                <p className="text-xs text-slate-500">
                  Your reservation is confirmed and your receipt has been generated.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-black text-emerald-600 text-sm">
                    {formatCurrency(completedTx.amount, completedTx.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Payment Status</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    SUCCESS
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Provider Ref</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {completedTx.provider_reference || completedTx.id.slice(0, 13)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Facility / Slot</span>
                  <span className="font-medium text-slate-800">
                    {booking.facility?.name || 'Facility'} ({booking.booking_date} {booking.start_time.slice(0, 5)})
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={onClose}
                  className="w-full bg-sports-navy text-white font-bold rounded-xl py-3 shadow-md"
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* PROCESSING STATE */}
          {step === 'PROCESSING' && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-sports-primary animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Authorizing & Verifying Payment...</h3>
                <p className="text-xs text-slate-500">
                  Please do not refresh the browser or close this window.
                </p>
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {step === 'ERROR' && (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-red-50/50">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Payment Failed</h3>
                <p className="text-xs text-red-600 font-medium">{errorMessage}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('FORM')}
                  className="w-full font-bold rounded-xl py-3"
                >
                  Try Another Card / Method
                </Button>
                <Button
                  onClick={handleSimulatePayment}
                  className="w-full bg-sports-navy text-white font-bold rounded-xl py-3 shadow-md"
                >
                  Retry Payment
                </Button>
              </div>
            </div>
          )}

          {/* FORM STATE */}
          {step === 'FORM' && (
            <div className="space-y-5">
              {/* Price Breakdown Banner */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Due</div>
                  <div className="text-2xl font-black text-sports-navy">
                    {formatCurrency(booking.total_amount, booking.currency)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-700">{booking.facility?.name || 'Facility'}</div>
                  <div className="text-[11px] text-slate-500">
                    {booking.booking_date} • {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                      paymentMethod === 'CARD'
                        ? 'border-sports-primary bg-sports-primary/5 text-sports-primary shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Credit / Debit Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ONLINE_BANKING')}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                      paymentMethod === 'ONLINE_BANKING'
                        ? 'border-sports-primary bg-sports-primary/5 text-sports-primary shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>Online Banking</span>
                  </button>
                </div>
              </div>

              {/* Card Inputs */}
              {paymentMethod === 'CARD' && (
                <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Cardholder Name</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sports-primary/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sports-primary/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sports-primary/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">CVC</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sports-primary/20"
                      />
                    </div>
                  </div>

                  {/* Sandbox Test Card Presets */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">Test Presets:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleFillTestCard('success')}
                        className="text-emerald-700 hover:underline font-bold"
                      >
                        Valid Card
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => handleFillTestCard('declined')}
                        className="text-red-600 hover:underline font-bold"
                      >
                        Declined Card
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Button
                  id="pay-now-submit-button"
                  onClick={handleSimulatePayment}
                  disabled={loading}
                  className="w-full bg-sports-navy hover:bg-slate-800 text-white font-bold rounded-xl py-3 shadow-md flex items-center justify-center gap-2"
                >
                  <span>Pay {formatCurrency(booking.total_amount, booking.currency)}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600 py-1"
                >
                  Cancel and Pay Later
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
