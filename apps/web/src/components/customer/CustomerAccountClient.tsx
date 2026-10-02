'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  User,
  Bell,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  Clock,
  Globe,
  Shield,
  HeartHandshake,
  Calendar,
  CreditCard,
  Sliders,
} from 'lucide-react';
import type { CustomerAccountProfile, CustomerAccountStats, NotificationPreference } from '@sportshub/types';

interface CustomerAccountClientProps {
  initialProfile: CustomerAccountProfile;
  initialStats: CustomerAccountStats;
  initialPreferences?: NotificationPreference | null;
}

export function CustomerAccountClient({
  initialProfile,
  initialStats,
  initialPreferences,
}: CustomerAccountClientProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');
  const [profile, setProfile] = useState<CustomerAccountProfile>(initialProfile);
  const [preferences, setPreferences] = useState<any>(
    initialPreferences || {
      in_app_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      booking_confirmations: true,
      booking_cancellations: true,
      payment_receipts: true,
      hold_reminders: true,
      marketing_emails: false,
    }
  );

  // Form states
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [language, setLanguage] = useState(profile.preferred_language || 'en');
  const [timezone, setTimezone] = useState(profile.timezone || 'Asia/Colombo');
  const [emergencyName, setEmergencyName] = useState(profile.emergency_contact_name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergency_contact_phone || '');
  const [notes, setNotes] = useState(profile.notes || '');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          display_name: displayName || null,
          phone: phone || null,
          preferred_language: language,
          timezone,
          emergency_contact_name: emergencyName || null,
          emergency_contact_phone: emergencyPhone || null,
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      setProfile(data.profile);
      setSuccessMessage('Profile settings saved successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update notification preferences.');
      }

      setPreferences(data.data || data.preferences || preferences);
      setSuccessMessage('Notification preferences updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <p className="leading-tight">{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
          <p className="leading-tight">{successMessage}</p>
        </div>
      )}

      {/* Account KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Bookings
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {initialStats.totalBookings}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Lifetime reservations</div>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Upcoming Matches
          </div>
          <div className="text-2xl font-bold text-sports-navy mt-1">
            {initialStats.upcomingBookings}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Ready to play</div>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Completed Games
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {initialStats.completedBookings}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Matches finished</div>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Paid
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {initialStats.currency} {initialStats.totalAmountPaid.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Verified payments</div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Card className="max-w-4xl border-slate-200/80 shadow-xs">
        <div className="flex border-b border-slate-200 mb-6 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-sports-navy text-sports-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Personal Profile & Athlete Info</span>
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
            <span>Notification & Email Preferences</span>
          </button>
        </div>

        {/* Tab 1: Profile Form */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-6 px-6 pb-6 text-xs">
            {/* Read-Only Account Identity */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block font-medium">Account Email</span>
                <span className="font-semibold text-slate-800 truncate block">{profile.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Customer ID</span>
                <span className="font-mono text-slate-600 text-[11px] truncate block">{profile.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Account Status</span>
                <span className="font-bold text-emerald-600 block">
                  {profile.is_active ? 'ACTIVE ATHLETE' : 'SUSPENDED'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kasun Silva"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Display / Nickname
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Silva"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Timezone
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                  >
                    <option value="Asia/Colombo">Asia/Colombo (UTC+05:30)</option>
                    <option value="Asia/Dubai">Asia/Dubai (UTC+04:00)</option>
                    <option value="Asia/Singapore">Asia/Singapore (UTC+08:00)</option>
                    <option value="Europe/London">Europe/London (UTC+00:00)</option>
                    <option value="America/New_York">America/New_York (UTC-05:00)</option>
                    <option value="Australia/Sydney">Australia/Sydney (UTC+10:00)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Language
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                  >
                    <option value="en">English</option>
                    <option value="si">Sinhala (සිංහල)</option>
                    <option value="ta">Tamil (தமிழ்)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Emergency Contact Name
                </label>
                <div className="relative">
                  <HeartHandshake className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="e.g. Nimalka Silva"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+94 71 987 6543"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Player Notes / Medical info (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any sports preferences, club affiliations, or health notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy resize-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <Button type="submit" size="sm" disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Profile</span>
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Notification Preferences */}
        {activeTab === 'notifications' && (
          <form onSubmit={handlePreferencesSubmit} className="space-y-6 px-6 pb-6 text-xs">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Transactional Notifications</h3>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={preferences.booking_confirmations}
                    onChange={(e) =>
                      setPreferences({ ...preferences, booking_confirmations: e.target.checked })
                    }
                    className="w-4 h-4 mt-0.5 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Booking Confirmations</span>
                    <span className="text-[11px] text-slate-400 block">
                      Receive immediate receipts and court access info when your booking is confirmed.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={preferences.hold_reminders}
                    onChange={(e) =>
                      setPreferences({ ...preferences, hold_reminders: e.target.checked })
                    }
                    className="w-4 h-4 mt-0.5 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Hold Expiration Warnings</span>
                    <span className="text-[11px] text-slate-400 block">
                      Get alert warnings 2 minutes before reserved temporary court holds expire.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={preferences.payment_receipts}
                    onChange={(e) =>
                      setPreferences({ ...preferences, payment_receipts: e.target.checked })
                    }
                    className="w-4 h-4 mt-0.5 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Payment & Refund Receipts</span>
                    <span className="text-[11px] text-slate-400 block">
                      Notifications when payments are verified or refund transactions are processed.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={preferences.booking_cancellations}
                    onChange={(e) =>
                      setPreferences({ ...preferences, booking_cancellations: e.target.checked })
                    }
                    className="w-4 h-4 mt-0.5 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Cancellation Confirmations</span>
                    <span className="text-[11px] text-slate-400 block">
                      Notices when a reserved booking is cancelled by you or the venue manager.
                    </span>
                  </div>
                </label>
              </div>

              <h3 className="font-bold text-slate-900 text-sm pt-4 border-t border-slate-100">
                Delivery Channels
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.in_app_enabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, in_app_enabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <span className="font-semibold text-slate-800">In-App Notification Center</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.email_enabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, email_enabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                  />
                  <span className="font-semibold text-slate-800">Email Notifications</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <Button type="submit" size="sm" disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Notification Preferences</span>
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
