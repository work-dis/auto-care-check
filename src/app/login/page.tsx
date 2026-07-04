'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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

      const redirectTarget =
        new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
      router.push(redirectTarget);
      router.refresh();
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">⚡</div>
          <h1 className="text-2xl font-bold text-neutral-100">AutoPulse</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Цифровой бортовой журнал автомобиля
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#0c0c0e] border border-neutral-800 rounded-xl p-6 space-y-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
        >
          <h2 className="text-lg font-semibold text-neutral-200 text-center">Вход в систему</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-400 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full bg-neutral-900/80 border ${fieldErrors.email ? 'border-red-600' : 'border-neutral-800'} rounded-lg px-4 py-2.5 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/60 transition-colors`}
              required
              autoFocus
            />
            {fieldErrors.email && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-400 mb-1.5">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className={`w-full bg-neutral-900/80 border ${fieldErrors.password ? 'border-red-600' : 'border-neutral-800'} rounded-lg px-4 py-2.5 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/60 transition-colors`}
              required
            />
            {fieldErrors.password && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-700/50 disabled:text-neutral-500 text-white font-medium rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>

          <p className="text-center text-sm text-neutral-500">
            Нет аккаунта?{' '}
            <Link href="/register" className="text-teal-500 hover:text-teal-400 transition-colors">
              Зарегистрироваться
            </Link>
          </p>
        </form>

        {/* Demo hint */}
        <div className="mt-4 rounded-xl border border-neutral-800/80 bg-neutral-950/70 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Доступ</p>
          <p className="mt-1 text-sm text-neutral-400">
            Войдите под своим зарегистрированным аккаунтом
          </p>
        </div>
      </div>
    </div>
  );
}
