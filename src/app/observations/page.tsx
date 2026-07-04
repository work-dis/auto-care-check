'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Plus,
  AlertTriangle,
  Info,
  AlertCircle,
  RefreshCw,
  Inbox,
  CheckCircle2,
} from 'lucide-react';
import { observationSchema } from '@/lib/validation';
import { useToast } from '@/components/ToastProvider';

interface VehicleSummary {
  id: string;
  displayName: string;
  isPrimary: boolean;
}

interface Observation {
  id: string;
  vehicleId: string;
  vehicle: { id: string; displayName: string };
  title: string;
  description: string | null;
  priority: 'normal' | 'high' | 'critical';
  state: 'open' | 'watching' | 'service_planned' | 'closed';
  maintenancePlanId: string | null;
  maintenancePlan: { id: string; title: string } | null;
  serviceRecordId: string | null;
  serviceRecord: { id: string; serviceName: string } | null;
  photoUrl: string | null;
  createdAt: string;
  closedAt: string | null;
}

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  open: { label: 'Открыто', color: 'text-red-400', bg: 'bg-red-950/10', border: 'border-red-500/20', dot: 'bg-red-500' },
  watching: { label: 'Наблюдение', color: 'text-orange-400', bg: 'bg-orange-950/10', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  service_planned: { label: 'Запланировано', color: 'text-blue-400', bg: 'bg-blue-950/10', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  closed: { label: 'Закрыто', color: 'text-neutral-500', bg: 'bg-neutral-900/30', border: 'border-neutral-700/30', dot: 'bg-neutral-600' },
};

const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  critical: { icon: AlertCircle, color: 'text-red-400' },
  high: { icon: AlertTriangle, color: 'text-orange-400' },
  normal: { icon: Info, color: 'text-teal-400' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 1) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return d.toLocaleDateString('ru-RU');
}

export default function ObservationsPage() {
  const { showToast } = useToast();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'all' | 'open' | 'watching' | 'service_planned' | 'closed'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    vehicleId: '',
    title: '',
    description: '',
    priority: 'normal' as string,
    state: 'open' as string,
  });

  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);

  // Fetch observations
  const fetchObservations = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams();
      if (stateFilter !== 'all') params.set('state', stateFilter);
      const url = `/api/observations${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setObservations(data.observations);
      } else {
        setApiError('Не удалось загрузить наблюдения');
      }
    } catch (err) {
      console.error(err);
      setApiError('Сетевая ошибка');
    } finally {
      setIsLoading(false);
    }
  }, [stateFilter]);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVehicles();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchVehicles]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchObservations();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchObservations]);

  // Local filter
  const filtered = vehicleFilter === 'all'
    ? observations
    : observations.filter((o) => o.vehicleId === vehicleFilter);

  const activeCounts: Record<string, number> = {};
  observations.forEach((o) => {
    const st = o.state;
    activeCounts[st] = (activeCounts[st] || 0) + 1;
  });

  // Create observation
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrors({});
    setIsSubmitting(true);

    const payload = {
      ...form,
      description: form.description || null,
    };

    const parsed = observationSchema.safeParse(payload);
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
      const res = await fetch(`/api/vehicles/${form.vehicleId}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (res.ok) {
        showToast('Наблюдение добавлено', 'success');
        setIsCreateOpen(false);
        resetForm();
        await fetchObservations();
      } else {
        const data = await res.json();
        setCreateErrors({ general: data.error?.message || 'Ошибка' });
      }
    } catch (err) {
      console.error(err);
      setCreateErrors({ general: 'Сетевая ошибка' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({ vehicleId: '', title: '', description: '', priority: 'normal', state: 'open' });
    setCreateErrors({});
  };

  // Close observation
  const handleClose = async (id: string) => {
    try {
      const res = await fetch(`/api/observations/${id}`, {
        method: 'POST',
      });
      if (res.ok) {
        showToast('Наблюдение закрыто', 'success');
        await fetchObservations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/85 py-4 px-6 md:px-10 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Eye className="h-6 w-6 text-teal-400" />
            <h1 className="text-xl font-black tracking-tight uppercase">Наблюдения</h1>
            {Object.keys(activeCounts).length > 0 && (
              <span className="text-xs font-bold bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full border border-teal-500/30">
                {(activeCounts.open || 0) + (activeCounts.watching || 0) + (activeCounts.service_planned || 0)} активных
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { resetForm(); setIsCreateOpen(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition"
            >
              <Plus className="h-4 w-4" />
              Добавить
            </button>
            <button
              onClick={fetchObservations}
              className="p-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition cursor-pointer"
              title="Обновить"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 py-8 max-w-5xl mx-auto space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {(['all', 'open', 'watching', 'service_planned', 'closed'] as const).map((key) => {
              const cfg = key === 'all' ? null : STATE_CONFIG[key];
              const count = key === 'all' ? observations.length : (activeCounts[key] || 0);
              const isActive = stateFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setStateFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                    isActive
                      ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {cfg && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
                  {key === 'all' ? 'Все' : cfg?.label}
                  <span className="ml-0.5 opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
          >
            <option value="all">Все автомобили</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.displayName}</option>
            ))}
          </select>
        </div>

        {apiError && (
          <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-sm text-red-400">{apiError}</div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-teal-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="h-16 w-16 text-neutral-700 mb-4" />
            <p className="text-lg font-medium text-neutral-400">
              {observations.length === 0 ? 'Наблюдений пока нет' : 'Нет по выбранному фильтру'}
            </p>
            {observations.length === 0 && (
              <button
                onClick={() => { resetForm(); setIsCreateOpen(true); }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black"
              >
                <Plus className="h-4 w-4" />
                Добавить наблюдение
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((obs) => {
              const scfg = STATE_CONFIG[obs.state] || STATE_CONFIG.closed;
              const pcfg = PRIORITY_CONFIG[obs.priority] || PRIORITY_CONFIG.normal;
              const PrioIcon = pcfg.icon;

              return (
                <div
                  key={obs.id}
                  className={`rounded-xl border ${scfg.border} ${scfg.bg} overflow-hidden`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${scfg.bg} border ${scfg.border} shrink-0`}>
                        <PrioIcon className={`h-5 w-5 ${pcfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-white">{obs.title}</h3>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {obs.vehicle.displayName}
                              {obs.maintenancePlan && ` · ${obs.maintenancePlan.title}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${scfg.border} ${scfg.color}`}>
                              {scfg.label}
                            </span>
                            <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                              {formatDate(obs.createdAt)}
                            </span>
                          </div>
                        </div>

                        {obs.description && (
                          <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{obs.description}</p>
                        )}

                        <div className="flex items-center gap-2 mt-3">
                          {obs.state !== 'closed' && (
                            <button
                              onClick={() => handleClose(obs.id)}
                              className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-teal-400 transition cursor-pointer"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Закрыть
                            </button>
                          )}
                          {obs.serviceRecord && (
                            <span className="text-[10px] text-teal-500">
                              ТО: {obs.serviceRecord.serviceName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 md:pt-20 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-neutral-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-teal-400" />
                Новое наблюдение
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
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {createErrors.general && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-sm text-red-400">{createErrors.general}</div>
              )}

              {/* Vehicle */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Автомобиль *</label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm((p) => ({ ...p, vehicleId: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  required
                >
                  <option value="">Выберите...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.displayName}</option>
                  ))}
                </select>
                {createErrors.vehicleId && <p className="mt-1 text-xs text-red-400">{createErrors.vehicleId}</p>}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Название *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  placeholder="Например: Стук в подвеске"
                  required
                />
                {createErrors.title && <p className="mt-1 text-xs text-red-400">{createErrors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Приоритет</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="normal">Обычный</option>
                    <option value="high">Высокий</option>
                    <option value="critical">Критический</option>
                  </select>
                </div>
                {/* State */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Состояние</label>
                  <select
                    value={form.state}
                    onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="open">Открыто</option>
                    <option value="watching">Наблюдение</option>
                    <option value="service_planned">Запланировано ТО</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Описание</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none min-h-[80px]"
                  placeholder="Подробное описание проблемы"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2 border-t border-neutral-800">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition cursor-pointer">
                  Отмена
                </button>
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition disabled:opacity-55 cursor-pointer">
                  {isSubmitting ? 'Создание...' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
