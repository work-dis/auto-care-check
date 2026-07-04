'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileClock,
  RefreshCw,
  Inbox,
  FileText,
  ArrowRight,
  XCircle,
} from 'lucide-react';

interface VehicleSummary {
  id: string;
  displayName: string;
  isPrimary: boolean;
}

interface ServiceRecordPlanItem {
  id: string;
  titleSnapshot: string;
  categorySnapshot: string;
  actionType: string;
  costSnapshot: number;
}

interface ServiceRecord {
  id: string;
  vehicleId: string;
  performedAt: string;
  mileage: number;
  serviceName: string;
  serviceContact: string | null;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  currency: string;
  notes: string | null;
  receiptUrl: string | null;
  state: 'confirmed' | 'voided' | 'draft';
  voidReason: string | null;
  planItems: ServiceRecordPlanItem[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCost(val: number, curr: string): string {
  const symbol = curr === 'RUB' ? '₽' : curr;
  return `${val.toLocaleString('ru-RU')} ${symbol}`;
}

export default function HistoryPage() {
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'confirmed' | 'voided'>('all');
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);

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
    }
  }, []);

  const fetchRecords = useCallback(async (vId: string) => {
    if (!vId) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/vehicles/${vId}/records`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.serviceRecords);
      } else {
        setApiError('Не удалось загрузить историю');
      }
    } catch (err) {
      console.error(err);
      setApiError('Сетевая ошибка');
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
      void fetchRecords(selectedVehicleId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedVehicleId, fetchRecords]);

  // Filters
  const filtered = records.filter((r) => {
    if (stateFilter !== 'all' && r.state !== stateFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.serviceName.toLowerCase().includes(q) ||
        r.planItems.some((p) => p.titleSnapshot.toLowerCase().includes(q));
    }
    return true;
  });

  const totalCosts = filtered
    .filter((r) => r.state === 'confirmed')
    .reduce((sum, r) => sum + Number(r.totalCost), 0);

  if (vehicles.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 p-6 md:p-10 text-white flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center">
          <FileClock className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
          <h2 className="text-xl font-bold mb-2">Нет автомобилей</h2>
          <p className="text-sm text-neutral-400 mb-6">Добавьте автомобиль, чтобы видеть историю обслуживания.</p>
          <Link href="/vehicles" className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black">
            Добавить автомобиль
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/85 py-4 px-6 md:px-10 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileClock className="h-6 w-6 text-teal-400" />
            <h1 className="text-xl font-black tracking-tight uppercase">История ТО</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.displayName}</option>
              ))}
            </select>
            <button
              onClick={() => fetchRecords(selectedVehicleId)}
              className="p-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition cursor-pointer"
              title="Обновить"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 py-8 max-w-5xl mx-auto space-y-6">
        {/* Filters + summary */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2">
            {(['all', 'confirmed', 'voided'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setStateFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                  stateFilter === key
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                {key === 'all' ? 'Все' : key === 'confirmed' ? 'Подтверждённые' : 'Отменённые'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {filtered.filter((r) => r.state === 'confirmed').length > 0 && (
              <div className="text-sm text-neutral-400">
                Итого: <span className="font-bold text-teal-400">{formatCost(totalCosts, 'RUB')}</span>
              </div>
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию..."
              className="w-full sm:w-56 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
            />
          </div>
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
              {records.length === 0 ? 'История обслуживания пуста' : 'Нет записей по выбранному фильтру'}
            </p>
            {records.length === 0 && (
              <Link
                href={`/vehicles/${selectedVehicleId}`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black"
              >
                Создать первую запись
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((record) => (
              <div
                key={record.id}
                className={`rounded-xl border overflow-hidden transition cursor-pointer hover:bg-white/[0.02] ${
                  record.state === 'voided'
                    ? 'border-red-500/15 bg-red-950/5 opacity-60'
                    : 'border-neutral-800 bg-neutral-900/40'
                }`}
                onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{record.serviceName}</h3>
                        {record.state === 'voided' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                            Отменена
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                        <span>{formatDate(record.performedAt)}</span>
                        <span>{record.mileage.toLocaleString('ru-RU')} км</span>
                        {record.totalCost > 0 && (
                          <span className="font-semibold text-teal-400">{formatCost(Number(record.totalCost), record.currency)}</span>
                        )}
                      </div>
                      {record.planItems.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {record.planItems.map((item) => (
                            <span key={item.id} className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                              {item.titleSnapshot}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ArrowRight className={`h-4 w-4 text-neutral-600 mt-1 transition ${
                      selectedRecord?.id === record.id ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Expanded detail */}
                {selectedRecord?.id === record.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-neutral-800/60 space-y-3">
                    {record.notes && (
                      <div className="mt-3 bg-neutral-900/60 rounded-lg p-3">
                        <p className="text-xs text-neutral-400 leading-relaxed">{record.notes}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-neutral-900/60 rounded-lg p-2.5">
                        <span className="text-[10px] text-neutral-500 uppercase font-semibold">Работы</span>
                        <p className="text-xs font-medium text-white mt-1">{formatCost(Number(record.laborCost), record.currency)}</p>
                      </div>
                      <div className="bg-neutral-900/60 rounded-lg p-2.5">
                        <span className="text-[10px] text-neutral-500 uppercase font-semibold">Запчасти</span>
                        <p className="text-xs font-medium text-white mt-1">{formatCost(Number(record.partsCost), record.currency)}</p>
                      </div>
                      <div className="bg-neutral-900/60 rounded-lg p-2.5">
                        <span className="text-[10px] text-neutral-500 uppercase font-semibold">Итого</span>
                        <p className="text-xs font-bold text-teal-400 mt-1">{formatCost(Number(record.totalCost), record.currency)}</p>
                      </div>
                      {record.serviceContact && (
                        <div className="bg-neutral-900/60 rounded-lg p-2.5">
                          <span className="text-[10px] text-neutral-500 uppercase font-semibold">Контакты</span>
                          <p className="text-xs font-medium text-white mt-1">{record.serviceContact}</p>
                        </div>
                      )}
                    </div>
                    {record.state === 'voided' && record.voidReason && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-950/10 p-3">
                        <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-300">{record.voidReason}</p>
                      </div>
                    )}
                    {record.receiptUrl && (
                      <a
                        href={record.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Чек
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
