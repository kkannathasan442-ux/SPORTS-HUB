'use client';

import React, { useState, useTransition } from 'react';
import { updateOrganizationAction } from '@/lib/owner/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  Building2,
  Globe,
  Mail,
  Phone,
  Clock,
  DollarSign,
  Calendar,
  CreditCard,
  Bell,
  Sliders,
} from 'lucide-react';
import type { OrganizationWithSettings } from '@sportshub/types';

interface OrganizationSettingsFormProps {
  organization: OrganizationWithSettings;
  isReadOnly?: boolean;
}

export function OrganizationSettingsForm({ organization, isReadOnly = false }: OrganizationSettingsFormProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'booking' | 'payment' | 'notifications'>('profile');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const settings = organization.settings || {
    booking: {
      min_booking_duration_minutes: 30,
      max_booking_duration_minutes: 480,
      hold_duration_minutes: 10,
      cancellation_window_hours: 2,
      buffer_minutes: 0,
      allow_auto_confirm: true,
    },
    payment: {
      enabled_methods: ['SANDBOX', 'PAYHERE', 'DIRECT_BANK', 'CASH'],
      allow_offline_payments: true,
      offline_payment_instructions: 'Pay at the front desk before game time.',
      tax_registration_number: null,
    },
    notifications: {
      email_enabled: true,
      sms_enabled: false,
      booking_confirmation_enabled: true,
      hold_reminder_enabled: true,
      marketing_consent_required: true,
    },
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateOrganizationAction(null, formData);
      if (res.success) {
        setSuccessMessage(res.message || 'Organization settings saved successfully.');
      } else {
        setErrorMessage(res.error || 'Failed to update organization.');
      }
    });
  };

  return (
    <Card className="max-w-4xl border-slate-200/80 shadow-xs">
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <p className="leading-tight">{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
          <p className="leading-tight">{successMessage}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-sports-navy text-sports-navy'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Organization Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('booking')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'booking'
              ? 'border-sports-navy text-sports-navy'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Booking Policies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payment')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'payment'
              ? 'border-sports-navy text-sports-navy'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Methods</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'border-sports-navy text-sports-navy'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={isReadOnly} className="space-y-6">
          {/* Identity Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Organization ID</span>
              <span className="font-mono text-slate-700 text-[11px] truncate block">{organization.id}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Unique Slug</span>
              <span className="font-mono text-slate-700 text-[11px] truncate block">{organization.slug}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Account Status</span>
              <span className="font-bold text-emerald-600 block">{organization.status}</span>
            </div>
          </div>

          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Organization Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={organization.name}
                    placeholder="e.g. Royal Sports Complex"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Business Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={organization.description || ''}
                  placeholder="Describe your sports complex, facilities, and amenities..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Official Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    defaultValue={organization.email || ''}
                    placeholder="contact@royalsports.lk"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Official Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={organization.phone || ''}
                    placeholder="+94 11 234 5678"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Website URL
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    name="website"
                    defaultValue={organization.website || ''}
                    placeholder="https://www.royalsports.lk"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Logo Image URL
                </label>
                <input
                  type="url"
                  name="logo_url"
                  defaultValue={organization.logo_url || ''}
                  placeholder="https://images.example.com/logo.png"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Currency
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    name="currency"
                    defaultValue={organization.currency || 'LKR'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all bg-white"
                  >
                    <option value="LKR">LKR (Sri Lankan Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                    <option value="SGD">SGD (Singapore Dollar)</option>
                    <option value="AUD">AUD (Australian Dollar)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Timezone
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    name="timezone"
                    defaultValue={organization.timezone || 'Asia/Colombo'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all bg-white"
                  >
                    <option value="Asia/Colombo">Asia/Colombo (UTC+05:30)</option>
                    <option value="Asia/Dubai">Asia/Dubai (UTC+04:00)</option>
                    <option value="Asia/Singapore">Asia/Singapore (UTC+08:00)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (UTC+05:30)</option>
                    <option value="Europe/London">Europe/London (UTC+00:00)</option>
                    <option value="America/New_York">America/New_York (UTC-05:00)</option>
                    <option value="Australia/Sydney">Australia/Sydney (UTC+10:00)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Booking Policies */}
          {activeTab === 'booking' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Temporary HOLD Duration (Minutes)
                </label>
                <input
                  type="number"
                  name="hold_duration_minutes"
                  min={1}
                  max={60}
                  defaultValue={settings.booking.hold_duration_minutes}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  How long a court slot is reserved before unconfirmed payment release (Default: 10 mins).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cancellation Window (Hours)
                </label>
                <input
                  type="number"
                  name="cancellation_window_hours"
                  min={0}
                  max={168}
                  defaultValue={settings.booking.cancellation_window_hours}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Cut-off notice required prior to start time for customer cancellation (Default: 2 hours).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Min Booking Duration (Minutes)
                </label>
                <input
                  type="number"
                  name="min_booking_duration_minutes"
                  min={15}
                  max={1440}
                  defaultValue={settings.booking.min_booking_duration_minutes}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Max Booking Duration (Minutes)
                </label>
                <input
                  type="number"
                  name="max_booking_duration_minutes"
                  min={30}
                  max={1440}
                  defaultValue={settings.booking.max_booking_duration_minutes}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="allow_auto_confirm"
                    defaultChecked={settings.booking.allow_auto_confirm}
                    className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Automatically confirm bookings upon verified payment receipt
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Payment Settings */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Enabled Payment Gateways & Methods
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {['SANDBOX', 'PAYHERE', 'DIRECT_BANK', 'CASH'].map((method) => (
                    <label
                      key={method}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="enabled_methods"
                        value={method}
                        defaultChecked={settings.payment.enabled_methods.includes(method)}
                        className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                      />
                      <span className="font-semibold text-slate-800">{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="allow_offline_payments"
                    defaultChecked={settings.payment.allow_offline_payments}
                    className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Allow Front Desk / Offline Cash & Bank Transfer payments
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Offline Payment Instructions
                </label>
                <textarea
                  name="offline_payment_instructions"
                  rows={2}
                  defaultValue={settings.payment.offline_payment_instructions || ''}
                  placeholder="e.g. Please settle cash payments at reception 15 minutes prior to game start."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tax / Business Registration Number
                </label>
                <input
                  type="text"
                  name="tax_registration_number"
                  defaultValue={settings.payment.tax_registration_number || ''}
                  placeholder="e.g. PV-123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="booking_confirmation_enabled"
                    defaultChecked={settings.notifications.booking_confirmation_enabled}
                    className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Automated Booking Confirmation Notifications
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Dispatches in-app and email receipts to customers upon payment confirmation.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="hold_reminder_enabled"
                    defaultChecked={settings.notifications.hold_reminder_enabled}
                    className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Hold Expiration Warning Reminders
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Sends reminders 2 minutes before reserved HOLD slots expire.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="email_enabled"
                    defaultChecked={settings.notifications.email_enabled}
                    className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Email Notification Delivery Channel
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Enables email notifications for bookings and transactions.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {!isReadOnly && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <Button
                type="submit"
                disabled={isPending}
                className="shadow-md flex items-center gap-2 px-6"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Settings</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </Card>
  );
}
