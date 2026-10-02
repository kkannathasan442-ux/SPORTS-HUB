'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Bell, Mail, ShieldAlert, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import type { NotificationPreference } from '@sportshub/types';

export function NotificationPreferencesCard() {
  const [preferences, setPreferences] = useState<Partial<NotificationPreference>>({
    email_booking_confirmations: true,
    email_payment_receipts: true,
    email_hold_reminders: true,
    email_cancellations: true,
    in_app_enabled: true,
    promotional_emails: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrefs() {
      try {
        const res = await fetch('/api/notification-preferences');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setPreferences(json.data);
          }
        }
      } catch (err: any) {
        setErrorMessage('Failed to load communication preferences');
      } finally {
        setIsLoading(false);
      }
    }
    loadPrefs();
  }, []);

  const handleToggle = (key: keyof NotificationPreference) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_booking_confirmations: preferences.email_booking_confirmations,
          email_payment_receipts: preferences.email_payment_receipts,
          email_hold_reminders: preferences.email_hold_reminders,
          email_cancellations: preferences.email_cancellations,
          in_app_enabled: preferences.in_app_enabled,
          promotional_emails: preferences.promotional_emails,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to save preferences');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-sports-accent rounded-xl">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-sports-navy">Notification & Communication Settings</h2>
            <p className="text-xs text-slate-500">Configure how and when you receive transactional and service updates.</p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="shadow-xs"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              <span>Saving...</span>
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 mr-1.5" />
              <span>Saved!</span>
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>

      {errorMessage && (
        <div className="m-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Section 1: Transactional (Core) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-sports-navy" />
            <h3 className="text-xs font-bold text-sports-navy uppercase tracking-wider">
              Transactional Email Alerts
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md">
              High Priority
            </span>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 hover:bg-slate-50/70 transition-colors cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Booking Confirmations</span>
                <span className="text-[11px] text-slate-500 block">Receive instant booking receipts with venue, court, and timing details.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_booking_confirmations ?? true}
                onChange={() => handleToggle('email_booking_confirmations')}
                className="w-4 h-4 text-sports-accent rounded-sm border-slate-300 focus:ring-sports-accent"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 hover:bg-slate-50/70 transition-colors cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Payment Receipts & Invoices</span>
                <span className="text-[11px] text-slate-500 block">Receive electronic payment verification receipts and transaction IDs.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_payment_receipts ?? true}
                onChange={() => handleToggle('email_payment_receipts')}
                className="w-4 h-4 text-sports-accent rounded-sm border-slate-300 focus:ring-sports-accent"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 hover:bg-slate-50/70 transition-colors cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Hold Expiry Reminders</span>
                <span className="text-[11px] text-slate-500 block">Alert me when a reserved 10-minute slot is about to expire.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_hold_reminders ?? true}
                onChange={() => handleToggle('email_hold_reminders')}
                className="w-4 h-4 text-sports-accent rounded-sm border-slate-300 focus:ring-sports-accent"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 hover:bg-slate-50/70 transition-colors cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Cancellation & Refund Notices</span>
                <span className="text-[11px] text-slate-500 block">Notices when a booking is cancelled or a refund is credited.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_cancellations ?? true}
                onChange={() => handleToggle('email_cancellations')}
                className="w-4 h-4 text-sports-accent rounded-sm border-slate-300 focus:ring-sports-accent"
              />
            </label>
          </div>
        </div>

        {/* Section 2: In-App Center */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-sports-navy" />
            <h3 className="text-xs font-bold text-sports-navy uppercase tracking-wider">
              In-App Notification Center
            </h3>
          </div>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 hover:bg-slate-50/70 transition-colors cursor-pointer">
            <div>
              <span className="text-xs font-bold text-slate-800 block">In-App Activity Notifications</span>
              <span className="text-[11px] text-slate-500 block">Show unread badges and live activity updates in the header bell.</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.in_app_enabled ?? true}
              onChange={() => handleToggle('in_app_enabled')}
              className="w-4 h-4 text-sports-accent rounded-sm border-slate-300 focus:ring-sports-accent"
            />
          </label>
        </div>

        {/* Section 3: Promotional (Inactive in STEP 8) */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Marketing & Announcements
            </h3>
            <span className="text-[10px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-md">
              Optional
            </span>
          </div>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 cursor-pointer">
            <div>
              <span className="text-xs font-medium text-slate-700 block">Venue promotions & seasonal sports events</span>
              <span className="text-[11px] text-slate-400 block">Promotional campaigns are currently disabled in the platform.</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.promotional_emails ?? false}
              onChange={() => handleToggle('promotional_emails')}
              className="w-4 h-4 text-sports-accent rounded-sm border-slate-300 focus:ring-sports-accent"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
