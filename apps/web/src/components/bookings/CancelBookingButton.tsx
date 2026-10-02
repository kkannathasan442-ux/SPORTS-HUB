'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface CancelBookingButtonProps {
  bookingId: string;
  bookingReference: string;
  className?: string;
  variant?: 'outline' | 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function CancelBookingButton({
  bookingId,
  bookingReference,
  className = '',
  variant = 'outline',
  size = 'sm',
}: CancelBookingButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCancel = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          reason: reason.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to cancel reservation');
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error cancelling booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={`text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 ${className}`}
      >
        <XCircle className="w-3.5 h-3.5 mr-1.5" />
        Cancel Reservation
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cancel Reservation?</h3>
                <p className="text-xs text-slate-500">Ref: {bookingReference}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Are you sure you want to cancel this booking? This will release the reserved time slot immediately.
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="reason" className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for cancellation (optional)
              </label>
              <textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Change of schedule, weather, emergency..."
                className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Keep Reservation
              </Button>
              <Button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel Booking'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
