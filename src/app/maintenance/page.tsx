'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Plus,
  CheckCircle2,
  HelpCircle,
  Gauge,
  Calendar,
  Archive,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { maintenancePlanSchema } from '@/lib/validation';
import { useToast } from '@/components/ToastProvider';

interface VehicleSummary {
  id: string;
  displayName: string;
  isPrimary: boolean;
}

interface Category {
  id: string;
  name: string;
  iconKey: string | null;
}

interface MaintenancePlan {
  id: string;
  categoryId: string;
  category: Category;
  title: string;
  description: string | null;
  kind: string;
  priority: 'normal' | 'high' | 'critical';
  scheduleMode: string;
  intervalDays: number | null;
  intervalMileage: number | null;
  soonDaysThreshold: number;
  soonMileageThreshold: number;
  watchDaysThreshold: number;
  watchMileageThreshold: number;
  manualDueAt: string | null;
  manualDueMileage: number | null;
  manualStatus: string;
  disabledAt: string | null;
  lastCompletedAt: string | null;
  lastCompletedMileage: number | null;
  status?: 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' | 'disabled';
  statusReason?: string;
  nextDueAt?: string | null;
  nextDueMileage?: number | null;
}

type PlanPriority = 'normal' | 'high' | 'critical';
type PlanScheduleMode = 'date_only' | 'mileage_only' | 'whichever_comes_first' | 'manual';

type StatusFilter = 'all' | 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' | 'disabled';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  overdue: { label: 'Просрочено', color: 'text-red-400', bg: 'bg-red-950/10', border: 'border-red-500/20', dot: 'bg-red-500' },
  soon: { label: 'Скоро', color: 'text-orange-400', bg: 'bg-orange-950/10', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  watch: { label: 'Под присмотром', color: 'text-yellow-400', bg: 'bg-yellow-950/10', border: 'border-yellow-500/20', dot: 'bg-yellow-500' },
  normal: { label: 'В норме', color: 'text-teal-400', bg: 'bg-teal-950/10', border: 'border-teal-500/20', dot: 'bg-teal-500' },
  unknown: { label: 'Нет данных', color: 'text-neutral-400', bg: 'bg-neutral-900/30', border: 'border-neutral-700/30', dot: 'bg-neutral-500' },
  disabled: { label: 'Отключено', color: 'text-neutral-500', bg: 'bg-neutral-900/20', border: 'border-neutral-700/20', dot: 'bg-neutral-600' },
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Обычный',
  high: 'Высокий',
  critical: 'Критический',
};

const SCHEDULE_LABELS: Record<string, string> = {
  date_only: 'По дате',
  mileage_only: 'По пробегу',
  whichever_comes_first: 'Что наступит раньше',
  manual: 'Ручной режим',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function formatMileage(mileage: number | null): string {
  if (mileage === null || mileage === undefined) return '—';
  return mileage.toLocaleString('ru-RU') + ' км';
}

export default function MaintenancePage() {
  const { showToast } = useToast();

  // Vehicle selection
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);

  // Plans data
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create plan modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [planForm, setPlanForm] = useState<{
    categoryId: string;
    title: string;
    description: string;
    kind: string;
    priority: PlanPriority;
    scheduleMode: PlanScheduleMode;
    intervalDays: number;
    intervalMileage: number;
    soonDaysThreshold: number;
    soonMileageThreshold: number;
    watchDaysThreshold: number;
    watchMileageThreshold: number;
    manualDueAt: string;
    manualDueMileage: string;
    manualStatus: string;
  }>({
    categoryId: '',
    title: '',
    description: '',
    kind: 'scheduled_service',
    priority: 'normal',
    scheduleMode: 'whichever_comes_first',
    intervalDays: 365,
    intervalMileage: 10000,
    soonDaysThreshold: 30,
    soonMileageThreshold: 1000,
    watchDaysThreshold: 90,
    watchMileageThreshold: 3000,
    manualDueAt: '',
    manualDueMileage: '',
    manualStatus: 'auto',
  });

  // Expanded plan for detail view
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch vehicles
  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles);
        if (data.vehicles.length > 0) {
          const primary = data.vehicles.find((v: VehicleSummary) => v.isPrimary) || data.vehicles[0];
          setSelectedVehicleId(primary.id);
        } else {
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async (vId: string) => {
    try {
      const res = await fetch(`/api/categories?vehicleId=${vId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch plans
  const fetchPlans = useCallback(async (vId: string) => {
    if (!vId) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/vehicles/${vId}/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans);
      } else {
        setApiError('Не удалось загрузить планы обслуживания');
      }
    } catch (err) {
      console.error(err);
      setApiError('Сетевая ошибка при загрузке');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVehicles();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchVehicles]);

  useEffect(() => {
    if (!selectedVehicleId) return;

    const timer = window.setTimeout(() => {
      void fetchPlans(selectedVehicleId);
      void fetchCategories(selectedVehicleId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedVehicleId, fetchPlans, fetchCategories]);

  // Filter plans
  const filteredPlans = plans.filter((plan) => {
    if (statusFilter !== 'all' && plan.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = plan.title.toLowerCase().includes(q);
      const matchCategory = plan.category.name.toLowerCase().includes(q);
      if (!matchTitle && !matchCategory) return false;
    }
    return true;
  });

  // Count by status
  const countByStatus: Record<string, number> = {};
  plans.forEach((p) => {
    const st = p.status || 'unknown';
    countByStatus[st] = (countByStatus[st] || 0) + 1;
  });

  // Handle create plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;
    setCreateErrors({});
    setIsSubmitting(true);

    const payload = {
      ...planForm,
      description: planForm.description || null,
      manualDueAt: planForm.manualDueAt || null,
      manualDueMileage: planForm.manualDueMileage ? Number(planForm.manualDueMileage) : null,
    };

    const parsed = maintenancePlanSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setCreateErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/vehicles/${selectedVehicleId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (res.ok) {
        showToast('План обслуживания создан', 'success');
        setIsCreateOpen(false);
        resetForm();
        await fetchPlans(selectedVehicleId);
      } else {
        const data = await res.json();
        setCreateErrors({ general: data.error?.message || 'Ошибка при создании' });
      }
    } catch (err) {
      console.error(err);
      setCreateErrors({ general: 'Сетевая ошибка' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPlanForm({
      categoryId: '',
      title: '',
      description: '',
      kind: 'scheduled_service',
      priority: 'normal',
      scheduleMode: 'whichever_comes_first',
      intervalDays: 365,
      intervalMileage: 10000,
      soonDaysThreshold: 30,
      soonMileageThreshold: 1000,
      watchDaysThreshold: 90,
      watchMileageThreshold: 3000,
      manualDueAt: '',
      manualDueMileage: '',
      manualStatus: 'auto',
    });
    setCreateErrors({});
  };

  const handleArchivePlan = async (planId: string) => {
    try {
      const res = await fetch(`/api/plans/${planId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('План архивирован', 'success');
        await fetchPlans(selectedVehicleId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (vehicles.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 p-6 md:p-10 text-white flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center">
          <Wrench className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
          <h2 className="text-xl font-bold mb-2">Нет автомобилей</h2>
          <p className="text-sm text-neutral-400 mb-6">Добавьте автомобиль, чтобы управлять планами обслуживания.</p>
          <Link
            href="/vehicles"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black"
          >
            <Plus className="h-4 w-4" />
            Добавить автомобиль
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/85 py-4 px-6 md:px-10 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-teal-400" />
            <h1 className="text-xl font-black tracking-tight uppercase">Планы обслуживания</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.displayName}
                </option>
              ))}
            </select>
            <button
              onClick={() => { resetForm(); setIsCreateOpen(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition"
            >
              <Plus className="h-4 w-4" />
              Создать план
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 py-8 max-w-7xl mx-auto space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'overdue', 'soon', 'watch', 'normal', 'unknown'] as StatusFilter[]).map((key) => {
              const cfg = STATUS_CONFIG[key === 'all' ? 'normal' : key];
              const count = key === 'all' ? plans.length : (countByStatus[key] || 0);
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition border cursor-pointer ${
                    isActive
                      ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {key !== 'all' && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
                  {key === 'all' ? 'Все' : cfg.label}
                  <span className="ml-0.5 opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full sm:w-64 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
          />
        </div>

        {/* Error */}
        {apiError && (
          <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-sm text-red-400">
            {apiError}
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-teal-400" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <HelpCircle className="h-12 w-12 text-neutral-700 mb-4" />
            <p className="text-lg font-medium text-neutral-400">
              {plans.length === 0 ? 'Планов обслуживания пока нет' : 'Нет планов по выбранному фильтру'}
            </p>
            {plans.length === 0 && (
              <button
                onClick={() => { resetForm(); setIsCreateOpen(true); }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black"
              >
                <Plus className="h-4 w-4" />
                Создать первый план
              </button>
            )}
          </div>
        ) : (
          /* Plans list */
          <div className="space-y-3">
            {filteredPlans.map((plan) => {
              const cfg = STATUS_CONFIG[plan.status || 'unknown'] || STATUS_CONFIG.unknown;
              const isExpanded = expandedId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden transition`}
                >
                  {/* Card header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                    className="w-full flex items-center gap-4 p-4 text-left cursor-pointer hover:bg-white/[0.02] transition"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">{plan.title}</h3>
                        {plan.priority !== 'normal' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            plan.priority === 'critical' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'
                          }`}>
                            {PRIORITY_LABELS[plan.priority]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-neutral-500">{plan.category.name}</span>
                        <span className="text-[11px] text-neutral-600">·</span>
                        <span className={`text-[11px] font-medium ${cfg.color}`}>
                          {plan.statusReason || cfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {plan.disabledAt && (
                        <span className="text-[10px] text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">
                          Откл.
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-neutral-500" />
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-neutral-800/60 space-y-3">
                      {/* Schedule info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-neutral-900/60 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 uppercase font-semibold mb-1">
                            <Calendar className="h-3 w-3" />
                            Режим
                          </div>
                          <span className="text-xs font-medium text-white">{SCHEDULE_LABELS[plan.scheduleMode] || plan.scheduleMode}</span>
                        </div>
                        <div className="bg-neutral-900/60 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 uppercase font-semibold mb-1">
                            <Calendar className="h-3 w-3" />
                            Следующий срок
                          </div>
                          <span className="text-xs font-medium text-white">
                            {plan.nextDueAt ? formatDate(plan.nextDueAt) : (plan.nextDueMileage ? formatMileage(plan.nextDueMileage) : '—')}
                          </span>
                        </div>
                        <div className="bg-neutral-900/60 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 uppercase font-semibold mb-1">
                            <Gauge className="h-3 w-3" />
                            Интервал
                          </div>
                          <span className="text-xs font-medium text-white">
                            {plan.intervalDays ? `${plan.intervalDays} дн.` : ''}
                            {plan.intervalDays && plan.intervalMileage ? ' / ' : ''}
                            {plan.intervalMileage ? `${plan.intervalMileage.toLocaleString('ru-RU')} км` : '—'}
                          </span>
                        </div>
                        <div className="bg-neutral-900/60 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 uppercase font-semibold mb-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Последнее ТО
                          </div>
                          <span className="text-xs font-medium text-white">
                            {plan.lastCompletedAt ? formatDate(plan.lastCompletedAt) : '—'}
                            {plan.lastCompletedMileage ? ` / ${plan.lastCompletedMileage.toLocaleString('ru-RU')} км` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {plan.description && (
                        <p className="text-xs text-neutral-400 leading-relaxed">{plan.description}</p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Link
                          href={`/vehicles/${selectedVehicleId}?tab=plans`}
                          className="text-xs text-teal-400 hover:text-teal-300 transition"
                        >
                          Открыть в карточке авто →
                        </Link>
                        {!plan.disabledAt && (
                          <button
                            onClick={() => handleArchivePlan(plan.id)}
                            className="text-xs text-neutral-500 hover:text-red-400 transition ml-auto flex items-center gap-1"
                          >
                            <Archive className="h-3 w-3" />
                            Архивировать
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Plan Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 md:pt-20 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-neutral-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Wrench className="h-5 w-5 text-teal-400" />
                Новый план обслуживания
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="p-5 space-y-5 overflow-y-auto flex-1">
              {createErrors.general && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-sm text-red-400">
                  {createErrors.general}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Название *</label>
                <input
                  type="text"
                  value={planForm.title}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  placeholder="Например: Замена масла"
                  required
                />
                {createErrors.title && <p className="mt-1 text-xs text-red-400">{createErrors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Категория *</label>
                  <select
                    value={planForm.categoryId}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                    required
                  >
                    <option value="">Выберите...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {createErrors.categoryId && <p className="mt-1 text-xs text-red-400">{createErrors.categoryId}</p>}
                </div>

                {/* Priority */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Приоритет</label>
                  <select
                    value={planForm.priority}
                    onChange={(e) =>
                      setPlanForm((prev) => ({ ...prev, priority: e.target.value as PlanPriority }))
                    }
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="normal">Обычный</option>
                    <option value="high">Высокий</option>
                    <option value="critical">Критический</option>
                  </select>
                </div>
              </div>

              {/* Schedule Mode */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Режим планирования *</label>
                <select
                  value={planForm.scheduleMode}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      scheduleMode: e.target.value as PlanScheduleMode,
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                >
                  <option value="whichever_comes_first">Что наступит раньше (дата + пробег)</option>
                  <option value="date_only">Только по дате</option>
                  <option value="mileage_only">Только по пробегу</option>
                  <option value="manual">Ручной режим</option>
                </select>
              </div>

              {/* Intervals */}
              {planForm.scheduleMode !== 'manual' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Интервал (дни)</label>
                    <input
                      type="number"
                      value={planForm.intervalDays}
                      onChange={(e) => setPlanForm((prev) => ({ ...prev, intervalDays: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                      min={1}
                      disabled={planForm.scheduleMode === 'mileage_only'}
                    />
                    {createErrors.intervalDays && <p className="mt-1 text-xs text-red-400">{createErrors.intervalDays}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Интервал (км)</label>
                    <input
                      type="number"
                      value={planForm.intervalMileage}
                      onChange={(e) => setPlanForm((prev) => ({ ...prev, intervalMileage: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                      min={1}
                      disabled={planForm.scheduleMode === 'date_only'}
                    />
                    {createErrors.intervalMileage && <p className="mt-1 text-xs text-red-400">{createErrors.intervalMileage}</p>}
                  </div>
                </div>
              )}

              {/* Manual fields */}
              {planForm.scheduleMode === 'manual' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Ручной срок (дата)</label>
                    <input
                      type="date"
                      value={planForm.manualDueAt}
                      onChange={(e) => setPlanForm((prev) => ({ ...prev, manualDueAt: e.target.value }))}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Ручной срок (км)</label>
                    <input
                      type="number"
                      value={planForm.manualDueMileage}
                      onChange={(e) => setPlanForm((prev) => ({ ...prev, manualDueMileage: e.target.value }))}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                </div>
              )}

              {/* Thresholds */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Пороги срабатывания статусов</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-neutral-500">«Скоро» (дней)</label>
                      <input
                        type="number"
                        value={planForm.soonDaysThreshold}
                        onChange={(e) => setPlanForm((prev) => ({ ...prev, soonDaysThreshold: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500">«Под присмотром» (дней)</label>
                      <input
                        type="number"
                        value={planForm.watchDaysThreshold}
                        onChange={(e) => setPlanForm((prev) => ({ ...prev, watchDaysThreshold: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-neutral-500">«Скоро» (км)</label>
                      <input
                        type="number"
                        value={planForm.soonMileageThreshold}
                        onChange={(e) => setPlanForm((prev) => ({ ...prev, soonMileageThreshold: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500">«Под присмотром» (км)</label>
                      <input
                        type="number"
                        value={planForm.watchMileageThreshold}
                        onChange={(e) => setPlanForm((prev) => ({ ...prev, watchMileageThreshold: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Описание</label>
                <textarea
                  value={planForm.description}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none min-h-[80px]"
                  placeholder="Дополнительные заметки о работе"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition disabled:opacity-55 cursor-pointer"
                >
                  {isSubmitting ? 'Создание...' : 'Создать план'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
