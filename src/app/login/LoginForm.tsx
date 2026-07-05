'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  const widgetRef = useRef<HTMLDivElement>(null);
  const callbackRegistered = useRef(false);

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

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
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
  }, []);

  const botUsername =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
      : '';

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col justify-center flex-1">
        {/* Logo / Branding */}
        <div className="text-center mb-8 pt-8 md:pt-0">
          <div className="text-4xl mb-2">⚡</div>
          <h1 className="text-2xl font-bold text-neutral-100">AutoPulse</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Цифровой бортовой журнал автомобиля
          </p>
        </div>

        <div className="bg-[#0c0c0e] border border-neutral-800 rounded-xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <h2 className="text-lg font-semibold text-neutral-200 text-center mb-6">
            Вход через Telegram
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

          {botUsername ? (
            <div className="flex justify-center" ref={widgetRef} id="telegram-login-widget" />
          ) : (
            <p className="text-neutral-500 text-sm text-center">
              Telegram Bot не настроен. Укажите <code className="text-teal-400">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>.
            </p>
          )}
        </div>
      </div>

      <div className="w-full max-w-md mt-auto pb-4">
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/70 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">AutoPulse</p>
          <p className="mt-1 text-sm text-neutral-400">
            Войдите через Telegram для доступа к бортовому журналу
          </p>
        </div>
      </div>
    </div>
  );
}
