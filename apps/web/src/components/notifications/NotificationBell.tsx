'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, Check, ExternalLink, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@sportshub/types';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/notifications/unread-count');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUnreadCount(json.unreadCount);
        }
      }
    } catch {
      // Graceful silence on network error
    }
  };

  const fetchRecent = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=5');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setRecentNotifications(json.data || []);
        }
      }
    } catch {
      // Graceful silence
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRecent();
    }
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (res.ok) {
        setRecentNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-sports-navy hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sports-accent/40"
        title="Notifications"
        aria-label="View notifications"
        id="notification-bell-btn"
      >
        <Bell className="w-4 h-4 text-slate-600" />
        {unreadCount > 0 && (
          <span
            id="notification-badge"
            className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-extrabold text-white bg-rose-500 rounded-full shadow-xs animate-in zoom-in-50 duration-200"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-150 py-2 z-50 animate-in fade-in-50 slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sports-navy uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <Link
              href="/customer/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-sports-accent hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center gap-2">
                <Inbox className="w-8 h-8 text-slate-300" />
                <p className="text-xs text-slate-500 font-medium">No notifications yet</p>
              </div>
            ) : (
              recentNotifications.map((notif) => {
                const isUnread = !notif.read_at;
                return (
                  <div
                    key={notif.id}
                    className={cn(
                      'p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 text-left',
                      isUnread && 'bg-blue-50/40'
                    )}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-sports-accent shrink-0" />}
                        <p className={cn('text-xs font-bold truncate', isUnread ? 'text-sports-navy' : 'text-slate-700')}>
                          {notif.title}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {isUnread && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="p-1 text-slate-400 hover:text-sports-accent hover:bg-slate-100 rounded-md transition-colors shrink-0"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-100 text-center bg-slate-50/50 rounded-b-2xl">
            <Link
              href="/customer/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-slate-600 hover:text-sports-navy block py-1"
            >
              Open Notification Center &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
