'use client';

import { LogOut, UserCircle2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import NotificationBell from '@/components/NotificationBell';
import Sidebar from '@/components/Sidebar';

interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  defaultReminderTime: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

const AUTH_ROUTES = new Set(['/login', '/register']);

function getInitials(user: SessionUser) {
  const source = (user.name || user.email).trim();
  const [first = '', second = ''] = source.split(/\s+/);
  return `${first[0] || ''}${second[0] || ''}`.toUpperCase() || source.slice(0, 2).toUpperCase();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(!isAuthRoute);

  const redirectTarget = useMemo(() => {
    if (!pathname || pathname === '/') {
      return '/dashboard';
    }
    return pathname;
  }, [pathname]);

  const loadUser = useCallback(async () => {
    if (isAuthRoute) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });

      if (response.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load current user');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to load app shell user:', error);
      router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthRoute, redirectTarget, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUser();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUser]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      router.push('/login');
      router.refresh();
    }
  }, [router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] text-neutral-100">
        <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#121214] px-5 py-4 text-sm text-neutral-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-teal-500" />
          Загружаем рабочее пространство...
        </div>
      </div>
    );
  }

  const displayName = user.name || user.email;

  return (
    <>
      <Sidebar user={user} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen pb-16 md:pb-0">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-neutral-900 bg-[#0c0c0e]/60 px-4 backdrop-blur-md md:px-8">
          <span className="text-sm font-bold tracking-tight text-neutral-400">
            Бортовой компьютер
          </span>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden items-center gap-3 rounded-full border border-neutral-800 bg-neutral-950/80 px-3 py-1.5 md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-xs font-bold text-neutral-200">
                {getInitials(user)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-neutral-100">{displayName}</div>
                <div className="truncate text-xs text-neutral-500">{user.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
            <div className="md:hidden">
              <UserCircle2 className="h-5 w-5 text-neutral-500" />
            </div>
          </div>
        </header>
        <main className="flex-grow p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}
