'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, LayoutDashboard, Bell, Settings, ClipboardList, Eye, FileClock } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Табло', icon: LayoutDashboard },
    { href: '/vehicles', label: 'Гараж', icon: Car },
    { href: '/maintenance', label: 'Планы', icon: ClipboardList },
    { href: '/observations', label: 'Осмотр', icon: Eye },
    { href: '/history', label: 'История', icon: FileClock },
    { href: '/notifications', label: 'Оповещ.', icon: Bell },
    { href: '/settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Нижняя навигация"
      className="fixed bottom-0 left-0 right-0 z-20 flex h-16 border-t border-neutral-900 bg-[#121214]/95 backdrop-blur-md text-neutral-400 md:hidden"
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
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-200 ${
              isActive ? 'text-teal-400 font-medium' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] tracking-wide">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
