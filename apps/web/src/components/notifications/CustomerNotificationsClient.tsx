'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Bell,
  CheckCheck,
  Check,
  RefreshCw,
  Clock,
  ExternalLink,
  Inbox,
  Filter,
  CreditCard,
  Ticket,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Notification } from '@sportshub/types';
import { NotificationPreferencesCard } from './NotificationPreferencesCard';

export function CustomerNotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [filterUnread, setFilterUnread] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'preferences'>('notifications');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const url = `/api/notifications?page=${page}&limit=10${filterUnread ? '&unreadOnly=true' : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setNotifications(json.data || []);
          setTotalPages(json.pagination?.totalPages || 1);
          setTotal(json.pagination?.total || 0);
        }
      }

      // Fetch fast unread count
      const countRes = await fetch('/api/notifications/unread-count');
      if (countRes.ok) {
        const countJson = await countRes.json();
        if (countJson.success) {
          setUnreadCount(countJson.unreadCount);
        }
      }
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, filterUnread]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (res.ok) {
        const nowIso = new Date().toISOString();
        setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || nowIso })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type.startsWith('PAYMENT') || type.startsWith('REFUND')) {
      return <CreditCard className="w-4 h-4 text-emerald-600" />;
    }
    if (type.startsWith('BOOKING') || type.startsWith('WALK_IN')) {
      return <Ticket className="w-4 h-4 text-sports-accent" />;
    }
    return <AlertCircle className="w-4 h-4 text-amber-500" />;
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sports-navy text-white rounded-2xl shadow-xs">
            <Bell className="w-6 h-6 text-sports-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-sports-navy">Notification Center</h1>
              {unreadCount > 0 && (
                <span
                  id="customer-unread-pill"
                  className="px-2.5 py-0.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full"
                >
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Stay updated with your court reservations, payment receipts, and hold reminders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNotifications(true)}
            disabled={isRefreshing}
            className="p-2 text-slate-500 hover:text-sports-navy hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
            title="Refresh notifications"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </button>

          {unreadCount > 0 && (
            <Button
              id="mark-all-read-btn"
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs font-semibold flex items-center gap-1.5"
            >
              <CheckCheck className="w-4 h-4 text-slate-500" />
              <span>Mark All as Read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('notifications')}
          className={cn(
            'px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2',
            activeTab === 'notifications'
              ? 'bg-sports-navy text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>All Notifications ({total})</span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={cn(
            'px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2',
            activeTab === 'preferences'
              ? 'bg-sports-navy text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Preferences & Alerts</span>
        </button>
      </div>

      {activeTab === 'preferences' ? (
        <NotificationPreferencesCard />
      ) : (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => {
                  setFilterUnread(false);
                  setPage(1);
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                  !filterUnread ? 'bg-slate-200 text-sports-navy' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                All
              </button>
              <button
                onClick={() => {
                  setFilterUnread(true);
                  setPage(1);
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                  filterUnread ? 'bg-slate-200 text-sports-navy' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                Unread Only
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium">
              Page {page} of {totalPages}
            </span>
          </div>

          {/* List Area */}
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sports-accent mx-auto" />
              <p>Loading your notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Notifications</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {filterUnread
                  ? 'You have caught up with all your updates! No unread notifications.'
                  : 'You do not have any notifications yet. Book a court to get started!'}
              </p>
              {filterUnread && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFilterUnread(false)}
                  className="mt-2 text-xs"
                >
                  Show All Notifications
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => {
                const isUnread = !notif.read_at;
                return (
                  <div
                    key={notif.id}
                    id={`notification-card-${notif.id}`}
                    className={cn(
                      'p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4',
                      isUnread
                        ? 'bg-blue-50/40 border-blue-200 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="p-2.5 bg-white border border-slate-150 rounded-xl shadow-2xs shrink-0 mt-0.5">
                        {getNotificationIcon(notif.notification_type)}
                      </div>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'text-xs font-bold',
                              isUnread ? 'text-sports-navy' : 'text-slate-700'
                            )}
                          >
                            {notif.title}
                          </span>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-sports-accent shrink-0" />
                          )}
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                            {notif.notification_type.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {notif.message}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(notif.created_at).toLocaleString()}
                          </span>

                          {notif.related_entity_type === 'booking' && (
                            <Link
                              href="/customer/bookings"
                              className="text-sports-accent hover:underline font-semibold flex items-center gap-1"
                            >
                              <span>View Booking</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {isUnread && (
                      <div className="flex items-center self-end sm:self-center shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-xs text-slate-500 hover:text-sports-navy hover:bg-white border border-transparent hover:border-slate-200"
                        >
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          <span>Mark Read</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pagination controls */}
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
      )}
    </div>
  );
}
