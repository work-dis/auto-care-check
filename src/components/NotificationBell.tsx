'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  severity: string;
  readAt: string | null;
  createdAt: string;
  maintenancePlanId: string | null;
  vehicleId: string | null;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        const unread = data.notifications.filter((n: Notification) => !n.readAt).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();

    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors duration-200"
        aria-label="Уведомления"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#0e0e10] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-neutral-850 bg-[#121214]/95 backdrop-blur-md text-white shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-850 px-4 py-3 bg-[#0e0e10]/60">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Уведомления</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors"
              >
                Отметить все прочитанными
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[350px] overflow-y-auto divide-y divide-neutral-900">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell className="h-8 w-8 text-neutral-600 mb-2.5" />
                <p className="text-xs text-neutral-400">Нет новых уведомлений</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.readAt;
                let severityColor = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                if (notif.severity === 'warning') {
                  severityColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                } else if (notif.severity === 'critical') {
                  severityColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                }

                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-4 transition-colors duration-200 hover:bg-neutral-850/50 ${
                      isUnread ? 'bg-neutral-800/10' : 'opacity-65'
                    }`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase border ${severityColor}`}>
                          {notif.severity === 'critical' ? 'Срочно' : notif.severity === 'warning' ? 'Внимание' : 'Инфо'}
                        </span>
                        {isUnread && (
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-400"></span>
                        )}
                      </div>
                      <h4 className={`text-xs font-bold text-white leading-snug`}>{notif.title}</h4>
                      <p className="text-[11px] text-neutral-400 leading-normal">{notif.body}</p>
                      <p className="text-[9px] text-neutral-500">
                        {new Date(notif.createdAt).toLocaleDateString('ru-RU')} в {new Date(notif.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {isUnread && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="rounded-md border border-neutral-850 p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                        title="Прочитано"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* View history footer */}
          <div className="border-t border-neutral-900 bg-[#0e0e10]/60 p-2 text-center">
            <span className="text-[10px] text-neutral-500">
              Показываются последние 20 уведомлений
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
