'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, Car, LayoutDashboard, Bell, Settings, ClipboardList, Eye, FileClock, MoreHorizontal, X, Fuel } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const links = [
    { href: '/dashboard', label: 'Табло', icon: LayoutDashboard },
    { href: '/vehicles', label: 'Гараж', icon: Car },
    { href: '/maintenance', label: 'Планы', icon: ClipboardList },
    { href: '/history', label: 'История', icon: FileClock },
  ];
  const moreLinks = [
    { href: '/ownership', label: 'Эксплуатация', icon: Fuel },
    { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
    { href: '/observations', label: 'Наблюдения', icon: Eye },
    { href: '/notifications', label: 'Уведомления', icon: Bell },
    { href: '/settings', label: 'Настройки', icon: Settings },
  ];
  const moreIsActive = moreLinks.some(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  );

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Дополнительная навигация"
            className="absolute inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] rounded-2xl border border-neutral-800 bg-[#121214] p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-sm font-bold text-white">Ещё</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Закрыть меню"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl text-xs font-semibold ${
                      isActive ? 'bg-teal-500/10 text-teal-400' : 'bg-neutral-900 text-neutral-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <nav
        role="navigation"
        aria-label="Нижняя навигация"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-neutral-900 bg-[#121214]/95 pb-[env(safe-area-inset-bottom)] text-neutral-400 backdrop-blur-md md:hidden"
      >
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors duration-200 ${
                isActive ? 'font-medium text-teal-400' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-label="Ещё разделы"
          aria-expanded={moreOpen}
          className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-xs ${
            moreOpen || moreIsActive ? 'font-medium text-teal-400' : 'text-neutral-500'
          }`}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          <span>Ещё</span>
        </button>
      </nav>
    </>
  );
}
