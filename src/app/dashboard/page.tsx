'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Gauge,
  Calendar,
  AlertTriangle,
  Plus,
  TrendingUp,
  FileClock,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Eye,
  CheckCircle2,
  X
} from 'lucide-react';
import { odometerSchema } from '@/lib/validation';

interface VehicleSummary {
  id: string;
  displayName: string;
  isPrimary: boolean;
}

interface DashboardPlanItem {
  id: string;
  title: string;
  priority: string;
  statusReason: string;
  category: {
    name: string;
  };
}

interface DashboardData {
  vehicle: {
    id: string;
    displayName: string;
    currentMileage: number;
    mileageUnit: string;
  };
  readinessScore: number;
  activePlansCount: number;
  plansSummary: {
    overdue: number;
    soon: number;
    watch: number;
    normal: number;
    unknown: number;
  };
  openObservations: {
    critical: number;
    high: number;
    normal: number;
    total: number;
  };
  urgentItems: DashboardPlanItem[];
  upcomingItems: DashboardPlanItem[];
  watchItems: DashboardPlanItem[];
  lastServiceRecord: {
    id: string;
    performedAt: string;
    mileage: number;
    serviceName: string;
    totalCost: number;
    currency: string;
    notes: string | null;
  } | null;
  expenses: {
    last30Days: number;
    yearToDate: number;
    currency: string;
  };
}

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Odometer quick update form state
  const [odoOpen, setOdoOpen] = useState(false);
  const [odoMileage, setOdoMileage] = useState<number | ''>('');
  const [odoSource, setOdoSource] = useState<'manual' | 'correction' | 'service_record' | 'import'>('manual');
  const [odoComment, setOdoComment] = useState('');
  const [odoErrors, setOdoErrors] = useState<Record<string, string>>({});
  const [isSubmittingOdo, setIsSubmittingOdo] = useState(false);

  // Fetch all vehicles
  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles);
        if (data.vehicles.length > 0) {
          // Find primary vehicle or pick first
          const primary = data.vehicles.find((v: VehicleSummary) => v.isPrimary) || data.vehicles[0];
          setSelectedVehicleId(primary.id);
        } else {
          setIsLoading(false);
        }
      } else {
        setApiError('Не удалось загрузить автомобили');
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setApiError('Сетевая ошибка при загрузке автомобилей');
      setIsLoading(false);
    }
  }, []);

  // Fetch dashboard data for selected vehicle
  const fetchDashboardData = useCallback(async (vId: string) => {
    if (!vId) return;
    setIsDataLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/vehicles/${vId}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard);
        setOdoMileage(data.dashboard.vehicle.currentMileage);
      } else {
        setApiError('Не удалось загрузить данные приборной панели');
      }
    } catch (err) {
      console.error(err);
      setApiError('Сетевая ошибка при загрузке данных приборной панели');
    } finally {
      setIsDataLoading(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    if (selectedVehicleId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchDashboardData(selectedVehicleId);
    }
  }, [selectedVehicleId, fetchDashboardData]);

  // Handle quick mileage submission
  const handleOdoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboard) return;
    setOdoErrors({});
    setIsSubmittingOdo(true);

    const payload = {
      mileage: Number(odoMileage),
      source: odoSource,
      comment: odoComment.trim() || null,
      recordedAt: new Date().toISOString().split('T')[0],
    };

    const parsed = odometerSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setOdoErrors(fieldErrors);
      setIsSubmittingOdo(false);
      return;
    }

    // Business check for decrease
    if (Number(odoMileage) < dashboard.vehicle.currentMileage) {
      if (odoSource !== 'correction' || !odoComment.trim()) {
        setOdoErrors({
          mileage: 'Уменьшение пробега допускается только как "Корректировка" с обязательным указанием причины в комментарии.',
        });
        setIsSubmittingOdo(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/vehicles/${dashboard.vehicle.id}/odometer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setOdoOpen(false);
        setOdoComment('');
        setOdoSource('manual');
        // Refresh dashboard data
        await fetchDashboardData(dashboard.vehicle.id);
      } else {
        const errorData = await res.json();
        setOdoErrors({ general: errorData.error?.message || 'Не удалось обновить пробег' });
      }
    } catch (err) {
      console.error(err);
      setOdoErrors({ general: 'Сетевая ошибка при обновлении пробега' });
    } finally {
      setIsSubmittingOdo(false);
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      default:
        return 'bg-neutral-800 text-neutral-400 border border-neutral-700';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'Критический';
      case 'high':
        return 'Высокий';
      default:
        return 'Обычный';
    }
  };

  const formatCost = (val: number, curr: string) => {
    const symbol = curr === 'RUB' ? '₽' : curr;
    return `${val.toLocaleString('ru-RU')} ${symbol}`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-teal-400" />
          <p className="text-sm font-medium text-neutral-400">Считывание показателей панели...</p>
        </div>
      </div>
    );
  }

  // 1. If user has no vehicles
  if (vehicles.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 p-6 md:p-10 text-white flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center backdrop-blur-md shadow-2xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800/80 border border-neutral-700">
            <Gauge className="h-8 w-8 text-teal-400 animate-pulse" />
          </div>
          <h2 className="mb-3 text-xl font-bold tracking-tight">Ваш гараж пуст</h2>
          <p className="mb-8 text-sm leading-relaxed text-neutral-400">
            Для запуска приборной панели AutoPulse необходимо добавить хотя бы один автомобиль в гараж.
          </p>
          <Link
            href="/vehicles"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-teal-400 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            Добавить первый автомобиль
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24 md:pb-10">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/85 py-4 px-6 md:px-10 backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400 mb-1">
            <span className="h-2 w-2 rounded-full bg-teal-500 animate-ping"></span>
            AutoPulse Live
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-neutral-50 uppercase">
            Приборная панель
          </h1>
        </div>

        {/* Vehicle Selection dropdown */}
        <div className="flex items-center gap-3">
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus:border-teal-500 focus:outline-none"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.displayName} {v.isPrimary ? '(Основной)' : ''}
              </option>
            ))}
          </select>

          <Link
            href={`/vehicles/${selectedVehicleId}`}
            className="flex items-center justify-center p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition"
            title="Перейти к управлению"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-6 md:px-10 py-8 max-w-7xl mx-auto space-y-8">
        {apiError && (
          <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-400">
            {apiError}
          </div>
        )}

        {isDataLoading && !dashboard ? (
          // Skeleton loader
          <div className="space-y-6 animate-pulse">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
              <div className="md:col-span-2 h-48 rounded-2xl bg-neutral-900/60 border border-neutral-800/50" />
              <div className="h-48 rounded-2xl bg-neutral-900/60 border border-neutral-800/50" />
            </div>
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[500px] rounded-2xl bg-neutral-900/60 border border-neutral-800/50" />
              ))}
            </div>
          </div>
        ) : dashboard ? (
          <div className="space-y-8 animate-fade-in">
            {/* Quick Metrics Header Row */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
              {/* Odometer Widget (Dashboard Style) */}
              <div className="md:col-span-2 rounded-2xl border border-neutral-800/80 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 h-40 w-40 bg-teal-500/5 rounded-full filter blur-3xl pointer-events-none group-hover:bg-teal-500/10 transition duration-700"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-teal-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Текущий пробег</span>
                  </div>
                  <button
                    onClick={() => {
                      setOdoMileage(dashboard.vehicle.currentMileage);
                      setOdoOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-xs font-bold text-teal-400 transition hover:bg-teal-500 hover:text-neutral-950"
                  >
                    Обновить
                  </button>
                </div>

                <div className="flex items-baseline gap-1 my-4">
                  <span className="font-mono text-5xl md:text-6xl font-black tracking-widest text-white tabular-nums drop-shadow-[0_4px_12px_rgba(20,184,166,0.15)]">
                    {dashboard.vehicle.currentMileage.toLocaleString('ru-RU')}
                  </span>
                  <span className="font-mono text-sm font-semibold uppercase text-teal-500">
                    {dashboard.vehicle.mileageUnit}
                  </span>
                </div>

                <div className="text-xs text-neutral-500 mt-2 border-t border-neutral-800/60 pt-3">
                  Для изменения истории одометра перейдите в детальную карточку машины.
                </div>
              </div>

              {/* Readiness Score Card */}
              <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-6 flex flex-col items-center justify-between backdrop-blur-md relative overflow-hidden group">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 self-start w-full text-center">
                  Готовность по обслуживанию
                </div>

                {dashboard.activePlansCount < 3 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <HelpCircle className="h-10 w-10 text-neutral-600 mb-2.5" />
                    <p className="text-sm font-medium text-neutral-400">
                      Заполните еще {3 - dashboard.activePlansCount} пункта, чтобы видеть сводку
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative flex items-center justify-center">
                      {/* Circular Progress Gauge */}
                      <svg className="h-32 w-32 transform -rotate-90" aria-hidden="true">
                        <circle cx="64" cy="64" r="52" className="stroke-neutral-800" strokeWidth="8" fill="transparent" />
                        <circle
                          cx="64" cy="64" r="52"
                          className={`transition-all duration-1000 ease-out ${
                            dashboard.readinessScore >= 80 ? 'stroke-teal-400'
                              : dashboard.readinessScore >= 50 ? 'stroke-orange-400'
                              : 'stroke-red-500'
                          }`}
                          strokeWidth="8" fill="transparent"
                          strokeDasharray={2 * Math.PI * 52}
                          strokeDashoffset={2 * Math.PI * 52 * (1 - dashboard.readinessScore / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="font-mono text-3xl font-black text-white">{dashboard.readinessScore}%</span>
                        <span className="text-[10px] uppercase font-bold text-neutral-500">Готов</span>
                      </div>
                    </div>
                    {/* Status legend */}
                    <div className="w-full grid grid-cols-2 gap-1.5 text-[10px] font-semibold">
                      {dashboard.plansSummary.overdue > 0 && (
                        <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/15 rounded-lg px-2 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                          <span className="text-red-400">{dashboard.plansSummary.overdue} просроч.</span>
                        </div>
                      )}
                      {dashboard.plansSummary.soon > 0 && (
                        <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/15 rounded-lg px-2 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                          <span className="text-orange-400">{dashboard.plansSummary.soon} скоро</span>
                        </div>
                      )}
                      {dashboard.plansSummary.watch > 0 && (
                        <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/15 rounded-lg px-2 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0" />
                          <span className="text-yellow-400">{dashboard.plansSummary.watch} наблюд.</span>
                        </div>
                      )}
                      {dashboard.plansSummary.normal > 0 && (
                        <div className="flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/15 rounded-lg px-2 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
                          <span className="text-teal-400">{dashboard.plansSummary.normal} в норме</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="w-full text-[10px] text-neutral-500 leading-normal text-center mt-3 border-t border-neutral-800/60 pt-3 italic">
                  * Индекс рассчитывается по плану ТО и не является технической диагностикой.
                </div>
              </div>
            </div>

            {/* Service Lists Columns Grid */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
              {/* Urgent Panel */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 flex flex-col h-[500px]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-400 mb-4 flex items-center gap-2 border-b border-neutral-800/80 pb-3">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                  Сделать сейчас ({dashboard.urgentItems.length})
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                  {dashboard.urgentItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500">
                      <Gauge className="h-10 w-10 text-neutral-800 mb-2" />
                      <p className="text-xs">Срочных задач нет</p>
                    </div>
                  ) : (
                    dashboard.urgentItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-red-500/10 bg-red-950/5 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-white leading-tight">{item.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${getPriorityBadgeColor(item.priority)}`}>
                            {getPriorityLabel(item.priority)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-red-400">{item.statusReason}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 pt-1.5 border-t border-neutral-900">
                          <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">{item.category.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Upcoming Panel */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 flex flex-col h-[500px]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-orange-400 mb-4 flex items-center gap-2 border-b border-neutral-800/80 pb-3">
                  <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                  Скоро понадобится ({dashboard.upcomingItems.length})
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                  {dashboard.upcomingItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500">
                      <Gauge className="h-10 w-10 text-neutral-800 mb-2" />
                      <p className="text-xs">Задач на подходе нет</p>
                    </div>
                  ) : (
                    dashboard.upcomingItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-orange-500/10 bg-orange-950/5 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-white leading-tight">{item.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${getPriorityBadgeColor(item.priority)}`}>
                            {getPriorityLabel(item.priority)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-orange-400">{item.statusReason}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 pt-1.5 border-t border-neutral-900">
                          <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">{item.category.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Watch Panel */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 flex flex-col h-[500px]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-400 mb-4 flex items-center gap-2 border-b border-neutral-800/80 pb-3">
                  <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                  Под присмотром ({dashboard.watchItems.length})
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                  {dashboard.watchItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500">
                      <Gauge className="h-10 w-10 text-neutral-800 mb-2" />
                      <p className="text-xs">Задач под наблюдением нет</p>
                    </div>
                  ) : (
                    dashboard.watchItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-yellow-500/10 bg-yellow-950/5 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-white leading-tight">{item.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${getPriorityBadgeColor(item.priority)}`}>
                            {getPriorityLabel(item.priority)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-yellow-400">{item.statusReason}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 pt-1.5 border-t border-neutral-900">
                          <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">{item.category.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row: Expenses, Observations and Last Completed Service */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
              {/* Financial Expenses summary */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 flex flex-col justify-between backdrop-blur-md">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-5 flex items-center gap-2">
                    <TrendingUp className="h-4.5 w-4.5 text-teal-400" />
                    Расходы на содержание
                  </h3>

                  <div className="grid gap-4 grid-cols-2">
                    <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/40">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">За 30 дней</span>
                      <span className="text-xl font-bold tracking-tight text-white">
                        {formatCost(dashboard.expenses.last30Days, dashboard.expenses.currency)}
                      </span>
                    </div>

                    <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/40">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">С начала года (YTD)</span>
                      <span className="text-xl font-bold tracking-tight text-white">
                        {formatCost(dashboard.expenses.yearToDate, dashboard.expenses.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-[10px] text-neutral-500 italic">
                  Сводка рассчитывается по подтвержденным записям истории обслуживания.
                </div>
              </div>

              {/* Open Observations widget */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 flex flex-col justify-between backdrop-blur-md">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-5 flex items-center gap-2">
                    <Eye className="h-4.5 w-4.5 text-amber-400" />
                    Открытые наблюдения
                  </h3>

                  {dashboard.openObservations.total === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <CheckCircle2 className="h-10 w-10 text-teal-800 mb-2" />
                      <p className="text-xs text-neutral-500">Активных симптомов нет</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.openObservations.critical > 0 && (
                        <div className="flex items-center justify-between bg-red-500/10 border border-red-500/15 rounded-xl px-4 py-3">
                          <span className="text-sm font-semibold text-red-300">Критических</span>
                          <span className="font-mono text-xl font-black text-red-400">{dashboard.openObservations.critical}</span>
                        </div>
                      )}
                      {dashboard.openObservations.high > 0 && (
                        <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/15 rounded-xl px-4 py-3">
                          <span className="text-sm font-semibold text-orange-300">Высокий приоритет</span>
                          <span className="font-mono text-xl font-black text-orange-400">{dashboard.openObservations.high}</span>
                        </div>
                      )}
                      {dashboard.openObservations.normal > 0 && (
                        <div className="flex items-center justify-between bg-neutral-800/80 border border-neutral-700 rounded-xl px-4 py-3">
                          <span className="text-sm font-semibold text-neutral-300">Обычных</span>
                          <span className="font-mono text-xl font-black text-neutral-400">{dashboard.openObservations.normal}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/vehicles/${selectedVehicleId}?tab=observations`}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition"
                  >
                    Все наблюдения
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Latest Completed Work */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 flex flex-col justify-between backdrop-blur-md">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-5 flex items-center gap-2">
                    <FileClock className="h-4.5 w-4.5 text-teal-400" />
                    Последняя выполненная работа
                  </h3>

                  {dashboard.lastServiceRecord ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold text-white">{dashboard.lastServiceRecord.serviceName}</span>
                        <span className="text-xs font-bold text-teal-400">
                          {formatCost(Number(dashboard.lastServiceRecord.totalCost), dashboard.lastServiceRecord.currency)}
                        </span>
                      </div>

                      <div className="flex gap-4 text-xs text-neutral-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-neutral-600" />
                          <span>{new Date(dashboard.lastServiceRecord.performedAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Gauge className="h-3.5 w-3.5 text-neutral-600" />
                          <span>{dashboard.lastServiceRecord.mileage.toLocaleString('ru-RU')} км</span>
                        </div>
                      </div>

                      {dashboard.lastServiceRecord.notes && (
                        <p className="text-xs text-neutral-500 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900 mt-2 line-clamp-2 leading-relaxed">
                          {dashboard.lastServiceRecord.notes}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center py-6 text-center text-xs text-neutral-500">
                      История выполненных работ пуста
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/vehicles/${selectedVehicleId}`}
                    className="text-xs font-bold text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 transition"
                  >
                    История обслуживания
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Slide-over sheet for quick odometer update */}
      {odoOpen && dashboard && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOdoOpen(false)}></div>
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl border-t border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-5">
              <h3 className="text-lg font-bold tracking-tight">Обновление пробега</h3>
              <button
                onClick={() => setOdoOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleOdoSubmit} className="space-y-5">
              {odoErrors.general && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
                  {odoErrors.general}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Новый пробег ({dashboard.vehicle.mileageUnit}) <span className="text-teal-400">*</span>
                </label>
                <input
                  type="number"
                  name="mileage"
                  value={odoMileage}
                  onChange={(e) => setOdoMileage(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Введите новое показание"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  required
                />
                {odoErrors.mileage && <p className="mt-1 text-xs text-red-400">{odoErrors.mileage}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Тип записи
                </label>
                <select
                  name="source"
                  value={odoSource}
                  onChange={(e) => setOdoSource(e.target.value as 'manual' | 'correction' | 'service_record' | 'import')}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                >
                  <option value="manual">Вручную</option>
                  <option value="service_record">На сервисе</option>
                  <option value="correction">Корректировка</option>
                  <option value="import">Импорт данных</option>
                </select>
              </div>

              {/* Decrease Mileage Alert */}
              {odoMileage !== '' && Number(odoMileage) < dashboard.vehicle.currentMileage && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Внимание: Уменьшение пробега!</span>
                    Для снижения пробега выберите тип <strong>&quot;Корректировка&quot;</strong> и обязательно заполните текстовый комментарий с причиной.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Комментарий / Причина {odoMileage !== '' && Number(odoMileage) < dashboard.vehicle.currentMileage && <span className="text-amber-400">*</span>}
                </label>
                <input
                  type="text"
                  name="comment"
                  value={odoComment}
                  onChange={(e) => setOdoComment(e.target.value)}
                  placeholder={odoMileage !== '' && Number(odoMileage) < dashboard.vehicle.currentMileage ? "Укажите причину снижения пробега" : "По желанию (напр. Замена приборной панели)"}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
                {odoErrors.comment && <p className="mt-1 text-xs text-red-400">{odoErrors.comment}</p>}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setOdoOpen(false)}
                  className="flex-1 rounded-xl bg-neutral-800 py-3 text-sm font-semibold hover:bg-neutral-700 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOdo}
                  className="flex-1 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-teal-400 transition disabled:opacity-50"
                >
                  {isSubmittingOdo ? 'Обновление...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
