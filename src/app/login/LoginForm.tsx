'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const widgetRef = useRef<HTMLDivElement>(null);
  const callbackRegistered = useRef(false);

  const botUsername =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
      : '';

  async function handleUsernameLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setEmailLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.fieldErrors) {
          setFieldErrors(data.error.fieldErrors);
        } else {
          setError(data.error?.message || 'Ошибка входа');
        }
        return;
      }

      const redirectTarget = searchParams.get('redirect') || '/dashboard';
      router.push(redirectTarget);
      router.refresh();
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleTelegramAuth(initData: string) {
    setTgLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Ошибка входа через Telegram');
        return;
      }

      const redirectTarget =
        new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
      router.push(redirectTarget);
      router.refresh();
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setTgLoading(false);
    }
  }

  // Handle Telegram redirect callback
  useEffect(() => {
    const tgParam = searchParams.get('tg');
    if (!tgParam) return;

    const fullQuery = window.location.search.slice(1);
    if (!fullQuery) return;

    setTimeout(() => handleTelegramAuth(fullQuery), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Register global Telegram auth callback and inject widget
  useEffect(() => {
    if (callbackRegistered.current) return;
    callbackRegistered.current = true;

    window.onTelegramAuth = (user: TelegramUser) => {
      const params = new URLSearchParams();
      params.set('id', String(user.id));
      params.set('first_name', user.first_name);
      if (user.last_name) params.set('last_name', user.last_name);
      if (user.username) params.set('username', user.username);
      if (user.photo_url) params.set('photo_url', user.photo_url);
      params.set('auth_date', String(user.auth_date));
      params.set('hash', user.hash);

      handleTelegramAuth(params.toString());
    };

    if (botUsername && widgetRef.current && !widgetRef.current.querySelector('script')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'onTelegramAuth');
      script.setAttribute('data-request-access', 'write');
      widgetRef.current.appendChild(script);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botUsername]);

  return (
    <div className="w-full max-w-md">
      {/* Logo / Branding */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">⚡</div>
        <h1 className="text-2xl font-bold text-neutral-100">AutoPulse</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Цифровой бортовой журнал автомобиля
        </p>
      </div>

      <div className="bg-[#0c0c0e] border border-neutral-800 rounded-xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <h2 className="text-lg font-semibold text-neutral-200 text-center mb-6">
          Вход
        </h2>

        {error && (
          <div className="bg-red-900/30 border border-red-800/50 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {tgLoading && (
          <div className="bg-teal-900/30 border border-teal-800/50 text-teal-400 text-sm rounded-lg px-4 py-3 mb-4">
            Выполняется вход через Telegram...
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleUsernameLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-neutral-400 mb-1.5">
              Логин
            </label>
            <input
              id="username"
              type="text"
              placeholder="ivan123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full rounded-lg border bg-neutral-900/50 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors ${
                fieldErrors.username
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-neutral-800 focus:border-teal-500'
              }`}
            />
            {fieldErrors.username && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-400 mb-1.5">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-lg border bg-neutral-900/50 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors ${
                fieldErrors.password
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-neutral-800 focus:border-teal-500'
              }`}
            />
            {fieldErrors.password && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={emailLoading}
            className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emailLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-neutral-500">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-teal-400 hover:text-teal-300 transition-colors">
            Зарегистрироваться
          </Link>
        </div>

        {/* Telegram Login — показываем только если настроен бот */}
        {botUsername && (
          <div className="mt-6 pt-4 border-t border-neutral-800">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0c0c0e] px-2 text-neutral-600">или войти через</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-center" ref={widgetRef} id="telegram-login-widget" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
