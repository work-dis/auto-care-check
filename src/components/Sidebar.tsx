'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, LayoutDashboard, Settings, Bell, Wrench, ClipboardList, Eye, FileClock, LogOut } from 'lucide-react';

interface SidebarUser {
  email: string;
  name: string | null;
}

interface SidebarProps {
  user: SidebarUser;
  onLogout: () => void;
}

function getInitials(user: SidebarUser) {
  const source = (user.name || user.email).trim();
  const [first = '', second = ''] = source.split(/\s+/);
  return `${first[0] || ''}${second[0] || ''}`.toUpperCase() || source.slice(0, 2).toUpperCase();
}

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Приборная панель', icon: LayoutDashboard },
    { href: '/vehicles', label: 'Мои автомобили', icon: Car },
    { href: '/maintenance', label: 'Планы ТО', icon: ClipboardList },
    { href: '/observations', label: 'Наблюдения', icon: Eye },
    { href: '/history', label: 'История ТО', icon: FileClock },
    { href: '/notifications', label: 'Уведомления', icon: Bell },
    { href: '/settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-neutral-800 bg-[#121214] text-neutral-200 md:flex">
      {/* Logo Area */}
      <div className="flex h-16 items-center px-6 border-b border-neutral-900">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-black shadow-md shadow-teal-500/20">
            <Wrench className="h-4.5 w-4.5" />
          </div>
          <span className="text-lg">AutoPulse</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-4 py-6">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-teal-500/10 text-teal-400 border-l-2 border-teal-500 pl-2.5'
                  : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
              }`}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer / User Profile Area */}
      <div className="border-t border-neutral-900 p-4 bg-[#0e0e10]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-neutral-300">
            {getInitials(user)}
          </div>
          <div className="overflow-hidden">
            <p className="truncate text-sm font-semibold text-white">{user.name || user.email}</p>
            <p className="truncate text-xs text-neutral-500">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
