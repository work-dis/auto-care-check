'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.fieldErrors) {
          setFieldErrors(data.error.fieldErrors);
        } else {
          setError(data.error?.message || 'Ошибка регистрации');
        }
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  }

  const botUsername =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
      : '';

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
          Регистрация
        </h2>

        {error && (
          <div className="bg-red-900/30 border border-red-800/50 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-400 mb-1.5">
              Имя
            </label>
            <input
              id="name"
              type="text"
              placeholder="Иван Демидов"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-lg border bg-neutral-900/50 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors ${
                fieldErrors.name
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-neutral-800 focus:border-teal-500'
              }`}
            />
            {fieldErrors.name && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.name}</p>
            )}
          </div>

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
            <p className="text-neutral-500 text-xs mt-1">Логин (минимум 3 символа, латиница)</p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-400 mb-1.5">
              Пароль (минимум 6 символов)
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
            disabled={loading}
            className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Создание аккаунта...' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-500">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-teal-400 hover:text-teal-300 transition-colors">
            Войти
          </Link>
        </div>

        {/* Telegram — только если настроен бот */}
        {botUsername && (
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0c0c0e] px-2 text-neutral-600">или войти через</span>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248c-.105 1.107-.562 3.796-.794 5.034-.136.724-.405.966-.665.993-.433.045-.761-.286-1.18-.56-.669-.438-1.048-.71-1.697-1.136-.75-.492-.264-.762.162-1.203.111-.115 2.037-1.867 2.074-2.027.005-.024.009-.112-.042-.158-.05-.046-.126-.03-.18-.018-.077.018-1.296.823-3.654 2.415-.345.237-.658.353-.938.347-.307-.007-.896-.174-1.334-.316-.538-.175-.966-.268-.928-.566.018-.155.233-.314.64-.476 2.512-1.093 4.186-1.814 5.022-2.162 2.394-1.001 2.891-1.175 3.215-1.18.072-.001.232.017.335.102.087.072.11.168.116.238.005.075-.003.16-.009.226z"/>
                </svg>
                Telegram
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
