'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Bell,
  RefreshCw,
  Clock,
  ExternalLink,
  Inbox,
  Filter,
  CreditCard,
  Ticket,
  AlertCircle,
  Building2,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Notification } from '@sportshub/types';

export default function OwnerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  // Initialize Org Context
  useEffect(() => {
    async function loadOrgContext() {
      try {
        const res = await fetch('/api/owner/organization');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.organization) {
            setOrganizationId(json.organization.id);
            setOrgName(json.organization.name);
            setRole(json.membership?.role || 'STAFF');
          }
        }
      } catch (err) {
        console.warn('Failed to load organization context:', err);
      }
    }
    loadOrgContext();
  }, []);

  const fetchStaffNotifications = useCallback(
    async (isSilent = false) => {
      if (!organizationId) return;

      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const typeParam = filterType !== 'ALL' ? `&notificationType=${filterType}` : '';
        const url = `/api/notifications?organizationId=${organizationId}&page=${page}&limit=15${typeParam}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setNotifications(json.data || []);
            setTotalPages(json.pagination?.totalPages || 1);
            setTotal(json.pagination?.total || 0);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch org notifications:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [organizationId, filterType, page]
  );

  useEffect(() => {
    if (organizationId) {
      fetchStaffNotifications();
    }
  }, [organizationId, fetchStaffNotifications]);

  const getNotificationBadge = (type: string) => {
    if (type.startsWith('PAYMENT_SUCCESS') || type.startsWith('REFUND')) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
          Financial
        </span>
      );
    }
    if (type.startsWith('PAYMENT_FAILED')) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200">
          Payment Alert
        </span>
      );
    }
    if (type === 'WALK_IN_BOOKING_CREATED') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
          Walk-In Desk
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-sports-navy border border-blue-200">
        Booking
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sports-navy text-white rounded-2xl shadow-xs">
            <Bell className="w-6 h-6 text-sports-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-sports-navy">Organization Activity & Notifications</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Shield className="w-3 h-3 text-sports-accent" />
                {role}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Audit log and live operational notifications for {orgName || 'your organization'}.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchStaffNotifications(true)}
          disabled={isRefreshing || !organizationId}
          className="p-2 text-slate-500 hover:text-sports-navy hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 self-start sm:self-auto"
          title="Refresh notifications"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {[
            { label: 'All Events', val: 'ALL' },
            { label: 'Bookings', val: 'BOOKING_CONFIRMED' },
            { label: 'Walk-Ins', val: 'WALK_IN_BOOKING_CREATED' },
            { label: 'Payments', val: 'PAYMENT_SUCCESS' },
            { label: 'Refunds', val: 'REFUND_PROCESSED' },
          ].map((tab) => (
            <button
              key={tab.val}
              onClick={() => {
                setFilterType(tab.val);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                filterType === tab.val
                  ? 'bg-sports-navy text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Total Records: {total}
        </span>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-sports-accent mx-auto" />
          <p>Loading activity records...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">No Activity Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No notification records matching the selected criteria for this organization.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl shrink-0 mt-0.5">
                  {notif.notification_type.startsWith('PAYMENT') || notif.notification_type.startsWith('REFUND') ? (
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Ticket className="w-4 h-4 text-sports-navy" />
                  )}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{notif.title}</span>
                    {getNotificationBadge(notif.notification_type)}
                    <span className="text-[10px] text-slate-400 font-mono">
                      CH: {notif.channel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(notif.created_at).toLocaleString()}
                    </span>

                    {notif.related_entity_type === 'booking' && (
                      <Link
                        href="/owner/bookings"
                        className="text-sports-accent hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>View in Bookings</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}

                    {notif.related_entity_type === 'payment' && (
                      <Link
                        href="/owner/payments"
                        className="text-sports-accent hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>View in Payments</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-xs"
              >
                Previous
              </Button>
              <span className="text-xs font-semibold text-slate-500">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="text-xs"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
