'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  Filter,
  Inbox,
  Archive,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  severity: 'normal' | 'warning' | 'critical';
  status: string;
  readAt: string | null;
  createdAt: string;
  maintenancePlanId: string | null;
  vehicleId: string | null;
}

type TabMode = 'active' | 'history';
type ReadFilter = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabMode>('active');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const fetchNotifications = useCallback(
    async (cursor?: string, append = false) => {
      try {
        if (!append) setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('tab', tab);
        if (readFilter !== 'all') params.set('read', readFilter);
        if (cursor) params.set('cursor', cursor);
        params.set('limit', '50');

        const res = await fetch(`/api/notifications?${params}`);
        if (!res.ok) throw new Error('Не удалось загрузить уведомления');

        const data = await res.json();
        if (append) {
          setNotifications((prev) => [...prev, ...data.notifications]);
        } else {
          setNotifications(data.notifications);
        }
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [tab, readFilter]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
        );
      }
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
        );
      }
    } catch {
      // silent
    }
  };

  const handleLoadMore = () => {
    if (nextCursor && !isLoadingMore) {
      setIsLoadingMore(true);
      void fetchNotifications(nextCursor, true);
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          dot: 'bg-red-500',
          bg: 'bg-red-500/5',
          border: 'border-red-500/15',
          label: 'bg-red-500/10 text-red-400 border-red-500/20',
          text: 'text-red-400',
          labelText: 'Срочно',
        };
      case 'warning':
        return {
          dot: 'bg-amber-500',
          bg: 'bg-amber-500/5',
          border: 'border-amber-500/15',
          label: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          text: 'text-amber-400',
          labelText: 'Внимание',
        };
      default:
        return {
          dot: 'bg-teal-500',
          bg: 'bg-teal-500/5',
          border: 'border-teal-500/15',
          label: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
          text: 'text-teal-400',
          labelText: 'Инфо',
        };
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/85 py-4 px-6 md:px-10 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400 mb-1">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-ping"></span>
              AutoPulse Live
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-neutral-50 uppercase flex items-center gap-3">
              <Bell className="h-7 w-7 text-teal-400" />
              Центр уведомлений
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-red-500 text-[11px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNotifications()}
              className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              title="Обновить"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs font-semibold text-teal-400 hover:bg-neutral-800 hover:text-teal-300 transition-colors"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Всё прочитано</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 py-6 max-w-4xl mx-auto space-y-6">
        {/* Tabs + Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab switcher */}
          <div className="flex rounded-xl border border-neutral-800 bg-neutral-900/60 p-0.5">
            <button
              onClick={() => setTab('active')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'active'
                  ? 'bg-teal-500/10 text-teal-400 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Активные
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'history'
                  ? 'bg-teal-500/10 text-teal-400 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Архив
            </button>
          </div>

          {/* Read filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <Filter className="h-3.5 w-3.5" />
              {readFilter === 'all'
                ? 'Все'
                : readFilter === 'unread'
                  ? 'Непрочитанные'
                  : 'Прочитанные'}
              <ChevronDown className="h-3 w-3" />
            </button>

            {showFilterMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 rounded-xl border border-neutral-850 bg-[#121214] shadow-xl z-50 overflow-hidden">
                {(['all', 'unread', 'read'] as ReadFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setReadFilter(f);
                      setShowFilterMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors ${
                      readFilter === f
                        ? 'bg-teal-500/10 text-teal-400'
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? 'Все' : f === 'unread' ? 'Непрочитанные' : 'Прочитанные'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <span className="text-[11px] text-neutral-500 ml-auto">
              {tab === 'history' ? 'История' : 'Активных'}: {notifications.length}
              {nextCursor ? '+' : ''}
            </span>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-teal-400" />
              <p className="text-sm text-neutral-500">Загрузка уведомлений...</p>
            </div>
          </div>
        ) : notifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800">
              {tab === 'history' ? (
                <Archive className="h-10 w-10 text-neutral-600" />
              ) : (
                <Inbox className="h-10 w-10 text-neutral-600" />
              )}
            </div>
            <h2 className="text-lg font-bold text-neutral-300 mb-2">
              {tab === 'history'
                ? 'История уведомлений пуста'
                : 'Нет активных уведомлений'}
            </h2>
            <p className="text-sm text-neutral-500 max-w-md">
              {tab === 'history'
                ? 'Все уведомления будут отображаться здесь после того, как их срок истечёт или они будут отмечены.'
                : 'Когда появятся срочные задачи или приблизится срок ТО, вы увидите их здесь.'}
            </p>
            {tab === 'active' && (
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-neutral-950 hover:bg-teal-400 transition-colors"
              >
                Вернуться на дашборд
              </Link>
            )}
          </div>
        ) : (
          /* Notifications list */
          <div className="space-y-2">
            {notifications.map((notif) => {
              const s = getSeverityStyle(notif.severity);
              const isUnread = !notif.readAt;

              return (
                <div
                  key={notif.id}
                  className={`group relative rounded-xl border transition-all duration-200 ${
                    isUnread
                      ? `${s.bg} ${s.border}`
                      : 'border-neutral-800/60 bg-neutral-900/20 opacity-70 hover:opacity-90'
                  } p-4 md:p-5`}
                >
                  <div className="flex items-start gap-4">
                    {/* Severity dot */}
                    <div
                      className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.label}`}
                    >
                      {notif.severity === 'critical' ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <Bell className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${s.label}`}
                        >
                          {s.labelText}
                        </span>
                        {isUnread && (
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`}></span>
                        )}
                        {notif.status === 'stale' && (
                          <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
                            Устарело
                          </span>
                        )}
                        {notif.status === 'cancelled' && (
                          <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
                            Отменено
                          </span>
                        )}
                      </div>

                      <h3
                        className={`text-sm leading-snug ${
                          isUnread ? 'font-bold text-white' : 'font-medium text-neutral-300'
                        }`}
                      >
                        {notif.title}
                      </h3>

                      <p className="text-xs text-neutral-400 leading-relaxed">{notif.body}</p>

                      <div className="flex items-center gap-3 text-[10px] text-neutral-500 pt-1">
                        <span>
                          {new Date(notif.createdAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        <span>
                          {new Date(notif.createdAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {notif.maintenancePlanId && (
                          <Link
                            href={`/vehicles/${notif.vehicleId}?tab=plans`}
                            className="text-teal-500 hover:text-teal-400 underline underline-offset-2"
                          >
                            К плану
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Mark as read button */}
                    {isUnread && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        className="shrink-0 rounded-lg border border-neutral-800 p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 focus:opacity-100"
                        title="Отметить прочитанным"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {nextCursor && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-6 py-3 text-xs font-bold text-neutral-400 hover:text-white hover:border-neutral-700 transition-all disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Загрузить ещё
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
