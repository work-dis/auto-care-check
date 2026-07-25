'use client';

import { BarChart3, Gauge, RefreshCw, Save, TrendingUp, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { formatMoney, SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/domain/money/currencies';

interface VehicleSummary {
  id: string;
  displayName: string;
  isPrimary: boolean;
}

interface AnalyticsData {
  role: 'owner' | 'editor' | 'viewer';
  vehicle: {
    id: string;
    displayName: string;
    mileageUnit: string;
    distanceThisYear: number;
  };
  byCurrency: Array<{
    currency: SupportedCurrency;
    service: number;
    fuel: number;
    total: number;
    forecast: number;
    costPerDistance: number | null;
    budget: number | null;
  }>;
  monthly: Array<{
    month: string;
    values: Record<SupportedCurrency, number>;
  }>;
  categories: Array<{
    category: string;
    values: Record<SupportedCurrency, number>;
  }>;
}

export default function AnalyticsPage() {
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgetCurrency, setBudgetCurrency] = useState<SupportedCurrency>('BYN');
  const [annualLimit, setAnnualLimit] = useState('');

  useEffect(() => {
    void fetch('/api/vehicles')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message);
        setVehicles(result.vehicles);
        setVehicleId(
          result.vehicles.find((vehicle: VehicleSummary) => vehicle.isPrimary)?.id ||
            result.vehicles[0]?.id ||
            '',
        );
      })
      .catch(() => showToast('Не удалось загрузить автомобили', 'error'));
  }, [showToast]);

  const load = useCallback(async () => {
    if (!vehicleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/analytics`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Ошибка аналитики');
      setData(result);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ошибка аналитики', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, vehicleId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const maxMonthly = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      1,
      ...data.monthly.flatMap((month) => SUPPORTED_CURRENCIES.map((currency) => month.values[currency])),
    );
  }, [data]);

  const saveBudget = async () => {
    const response = await fetch(`/api/vehicles/${vehicleId}/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: budgetCurrency, annualLimit: Number(annualLimit) }),
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error?.message || 'Не удалось сохранить бюджет', 'error');
      return;
    }
    showToast('Годовой бюджет сохранён', 'success');
    setAnnualLimit('');
    await load();
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold text-white">
            <BarChart3 className="h-8 w-8 text-teal-400" />
            Аналитика расходов
          </h1>
          <p className="mt-2 text-sm text-neutral-400">Без конвертации: каждая валюта анализируется отдельно.</p>
        </div>
        <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="min-h-11 rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 text-sm text-white sm:w-64">
          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.displayName}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-teal-400" /></div>
      ) : !data ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center text-neutral-500">Нет данных для анализа</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.byCurrency.map((item) => (
              <div key={item.currency} className="rounded-2xl border border-neutral-800 bg-[#121214] p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-teal-500/10 px-2 py-1 text-xs font-black text-teal-400">{item.currency}</span>
                  <TrendingUp className="h-4 w-4 text-neutral-600" />
                </div>
                <p className="mt-4 text-2xl font-black text-white">{formatMoney(item.total, item.currency)}</p>
                <dl className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between"><dt className="text-neutral-500">ТО</dt><dd>{formatMoney(item.service, item.currency)}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500">Топливо</dt><dd>{formatMoney(item.fuel, item.currency)}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500">Прогноз за год</dt><dd>{formatMoney(item.forecast, item.currency)}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500">На {data.vehicle.mileageUnit}</dt><dd>{item.costPerDistance === null ? '—' : formatMoney(item.costPerDistance, item.currency)}</dd></div>
                </dl>
                {item.budget && (
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-neutral-500"><span>Годовой бюджет</span><span>{Math.round((item.total / item.budget) * 100)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-800" role="progressbar" aria-valuenow={Math.round((item.total / item.budget) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Использование бюджета ${item.currency}`}>
                      <div className={`h-full rounded-full ${item.total > item.budget ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(100, (item.total / item.budget) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {(data.role === 'owner' || data.role === 'editor') && (
            <div className="rounded-2xl border border-neutral-800 bg-[#121214] p-5">
              <h2 className="flex items-center gap-2 font-bold text-white"><WalletCards className="h-5 w-5 text-teal-400" /> Годовой бюджет</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
                <select value={budgetCurrency} onChange={(event) => setBudgetCurrency(event.target.value as SupportedCurrency)} className="min-h-11 rounded-lg border border-neutral-800 bg-neutral-950 px-3 text-sm text-white">
                  {SUPPORTED_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                </select>
                <input type="number" min="1" inputMode="decimal" value={annualLimit} onChange={(event) => setAnnualLimit(event.target.value)} placeholder="Лимит на год" className="min-h-11 rounded-lg border border-neutral-800 bg-neutral-950 px-3 text-sm text-white" />
                <button type="button" disabled={!annualLimit} onClick={() => void saveBudget()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 text-sm font-bold text-black disabled:opacity-50"><Save className="h-4 w-4" /> Сохранить</button>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-800 bg-[#121214] p-5">
              <h2 className="font-bold text-white">По месяцам</h2>
              <div className="mt-4 space-y-4">
                {data.monthly.map((month) => (
                  <div key={month.month}>
                    <p className="mb-2 text-xs font-bold text-neutral-400">{new Date(`${month.month}-01`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</p>
                    <div className="space-y-1.5">
                      {SUPPORTED_CURRENCIES.filter((currency) => month.values[currency] > 0).map((currency) => (
                        <div key={currency} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 text-xs">
                          <span className="font-bold text-teal-400">{currency}</span>
                          <div className="h-2 rounded-full bg-neutral-800"><div className="h-full rounded-full bg-teal-500" style={{ width: `${(month.values[currency] / maxMonthly) * 100}%` }} /></div>
                          <span className="text-neutral-300">{formatMoney(month.values[currency], currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {data.monthly.length === 0 && <p className="text-sm text-neutral-500">Расходов в этом году пока нет.</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-[#121214] p-5">
              <h2 className="flex items-center gap-2 font-bold text-white"><Gauge className="h-5 w-5 text-teal-400" /> По категориям</h2>
              <div className="mt-4 space-y-3">
                {data.categories.map((category) => (
                  <div key={category.category} className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
                    <p className="text-sm font-semibold text-white">{category.category}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {SUPPORTED_CURRENCIES.filter((currency) => category.values[currency] > 0).map((currency) => (
                        <span key={currency} className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300">{formatMoney(category.values[currency], currency)}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
