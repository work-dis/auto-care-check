'use client';

import {
  Car,
  FileArchive,
  FileText,
  Fuel,
  Gauge,
  Plus,
  RefreshCw,
  ScanLine,
  Share2,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';
import {
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  formatMoney,
  type SupportedCurrency,
} from '@/domain/money/currencies';

type Tab = 'fuel' | 'documents' | 'tires' | 'sharing';
type DialogKind = 'fuel' | 'document' | 'tire' | 'member' | null;

interface VehicleSummary {
  id: string;
  displayName: string;
  isPrimary: boolean;
}

interface OwnershipData {
  vehicle: {
    id: string;
    displayName: string;
    currentMileage: number;
    mileageUnit: string;
  };
  role: 'owner' | 'editor' | 'viewer';
  documents: Array<{
    id: string;
    type: string;
    title: string;
    number: string | null;
    expiresAt: string | null;
    notes: string | null;
  }>;
  tireSets: Array<{
    id: string;
    name: string;
    season: string;
    brand: string | null;
    model: string | null;
    size: string | null;
    status: string;
    storageLocation: string | null;
    totalDistance: number;
  }>;
  fuelEntries: Array<{
    id: string;
    filledAt: string;
    mileage: number;
    liters: number;
    totalCost: number;
    currency: SupportedCurrency;
    station: string | null;
    fullTank: boolean;
    receiptUrl: string | null;
  }>;
  members: Array<{
    id: string;
    role: 'viewer' | 'editor';
    user: { username: string; name: string | null };
  }>;
  analytics: {
    totalLiters: number;
    averageConsumption: number | null;
    costByCurrency: Array<{ currency: SupportedCurrency; total: number }>;
  };
}

const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-teal-500 focus:outline-none';
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400';

function dateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function OwnershipDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-800 bg-[#121214] shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-[#121214] px-5 py-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function OwnershipPage() {
  const { showToast } = useToast();
  const { upload, uploading } = useCloudinaryUpload();
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [data, setData] = useState<OwnershipData | null>(null);
  const [tab, setTab] = useState<Tab>('fuel');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fuelForm, setFuelForm] = useState({
    filledAt: dateInputValue(),
    mileage: '',
    liters: '',
    totalCost: '',
    currency: 'BYN' as SupportedCurrency,
    station: '',
    fullTank: true,
    receiptUrl: '',
    notes: '',
  });
  const [documentForm, setDocumentForm] = useState({
    type: 'insurance',
    title: '',
    number: '',
    validFrom: '',
    expiresAt: '',
    notes: '',
  });
  const [tireForm, setTireForm] = useState({
    name: '',
    season: 'summer',
    brand: '',
    model: '',
    size: '',
    status: 'storage',
    storageLocation: '',
    installedMileage: '',
    totalDistance: '0',
    notes: '',
  });
  const [memberForm, setMemberForm] = useState({ username: '', role: 'viewer' });

  const loadVehicles = useCallback(async () => {
    const response = await fetch('/api/vehicles');
    if (!response.ok) throw new Error('Не удалось загрузить автомобили');
    const result = await response.json();
    setVehicles(result.vehicles);
    setVehicleId((current) => current || result.vehicles.find((vehicle: VehicleSummary) => vehicle.isPrimary)?.id || result.vehicles[0]?.id || '');
  }, []);

  const loadData = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/ownership`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Не удалось загрузить данные');
      setData(result);
      setFuelForm((current) => ({
        ...current,
        mileage: current.mileage || String(result.vehicle.currentMileage),
      }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ошибка загрузки', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, vehicleId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadVehicles().catch((error) => {
        showToast(error instanceof Error ? error.message : 'Ошибка загрузки', 'error');
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadVehicles, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const canEdit = data?.role === 'owner' || data?.role === 'editor';
  const tabs = useMemo(
    () => [
      { id: 'fuel' as const, label: 'Заправки', icon: Fuel },
      { id: 'documents' as const, label: 'Документы', icon: FileText },
      { id: 'tires' as const, label: 'Шины', icon: Gauge },
      { id: 'sharing' as const, label: 'Доступ и экспорт', icon: Share2 },
    ],
    [],
  );

  const save = async (kind: Exclude<DialogKind, null>, payload: Record<string, unknown>) => {
    if (!vehicleId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, data: payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Не удалось сохранить');
      setDialog(null);
      showToast('Запись сохранена', 'success');
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ошибка сохранения', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind: Exclude<DialogKind, null>, itemId: string) => {
    if (!vehicleId) return;
    const response = await fetch(`/api/vehicles/${vehicleId}/ownership`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, itemId }),
    });
    if (!response.ok) {
      const result = await response.json();
      showToast(result.error?.message || 'Не удалось удалить запись', 'error');
      return;
    }
    showToast('Запись удалена', 'info');
    await loadData();
  };

  const updateTireStatus = async (itemId: string, status: 'installed' | 'storage' | 'retired') => {
    const response = await fetch(`/api/vehicles/${vehicleId}/ownership`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'tire', itemId, status }),
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error?.message || 'Не удалось обновить комплект', 'error');
      return;
    }
    showToast(status === 'installed' ? 'Комплект установлен' : 'Статус комплекта обновлён', 'success');
    await loadData();
  };

  const recognizeReceipt = async (file: File) => {
    const imageUrl = await upload(file);
    if (!imageUrl) {
      showToast('Не удалось загрузить чек', 'error');
      return;
    }
    setFuelForm((current) => ({ ...current, receiptUrl: imageUrl }));
    const response = await fetch('/api/receipts/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error?.message || 'Не удалось распознать чек', 'info');
      return;
    }
    setFuelForm((current) => ({
      ...current,
      totalCost: result.fields.totalCost ? String(result.fields.totalCost) : current.totalCost,
      liters: result.fields.liters ? String(result.fields.liters) : current.liters,
      filledAt: result.fields.filledAt || current.filledAt,
      currency: SUPPORTED_CURRENCIES.includes(result.fields.currency)
        ? result.fields.currency
        : current.currency,
    }));
    showToast('Данные чека распознаны — проверьте поля', 'success');
  };

  const importBackup = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text());
      const response = await fetch('/api/vehicles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Не удалось импортировать файл');
      showToast('Резервная копия импортирована', 'success');
      await loadVehicles();
      setVehicleId(result.vehicle.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Некорректный файл', 'error');
    }
  };

  if (!loading && vehicles.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-[#121214] p-10 text-center">
        <Car className="mx-auto h-10 w-10 text-neutral-600" />
        <h1 className="mt-4 text-xl font-bold">Сначала добавьте автомобиль</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Эксплуатация</h1>
          <p className="mt-2 text-sm text-neutral-400">Заправки, документы, шины и совместный доступ в одном журнале.</p>
        </div>
        <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className={`${inputClass} sm:w-64`}>
          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.displayName}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-800 bg-[#121214] p-2 sm:grid-cols-4">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${tab === item.id ? 'bg-teal-500 text-black' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {loading || !data ? (
        <div className="flex min-h-64 items-center justify-center"><RefreshCw className="h-7 w-7 animate-spin text-teal-400" /></div>
      ) : (
        <>
          {tab === 'fuel' && (
            <section className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Всего топлива" value={`${data.analytics.totalLiters.toLocaleString('ru-RU')} л`} />
                <Metric label="Средний расход" value={data.analytics.averageConsumption ? `${data.analytics.averageConsumption.toFixed(1)} л/100 км` : 'Недостаточно данных'} />
                <Metric label="Заправок" value={String(data.fuelEntries.length)} />
              </div>
              {data.analytics.costByCurrency.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.analytics.costByCurrency.map((item) => (
                    <span key={item.currency} className="rounded-lg border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-sm font-bold text-teal-300">
                      {formatMoney(item.total, item.currency)}
                    </span>
                  ))}
                </div>
              )}
              <SectionHeader title="История заправок" canAdd={canEdit} onAdd={() => setDialog('fuel')} />
              <div className="space-y-2">
                {data.fuelEntries.map((entry) => (
                  <ItemCard key={entry.id} onDelete={canEdit ? () => void remove('fuel', entry.id) : undefined}>
                    <div>
                      <p className="font-bold text-white">{entry.station || 'Заправка'} · {Number(entry.liters).toLocaleString('ru-RU')} л</p>
                      <p className="mt-1 text-xs text-neutral-500">{new Date(entry.filledAt).toLocaleDateString('ru-RU')} · {entry.mileage.toLocaleString('ru-RU')} км · {entry.fullTank ? 'Полный бак' : 'Дозаправка'}</p>
                    </div>
                    <span className="font-bold text-teal-400">{formatMoney(Number(entry.totalCost), entry.currency)}</span>
                  </ItemCard>
                ))}
                {data.fuelEntries.length === 0 && <Empty text="Заправок пока нет" />}
              </div>
            </section>
          )}

          {tab === 'documents' && (
            <section className="space-y-4">
              <SectionHeader title="Документы автомобиля" canAdd={canEdit} onAdd={() => setDialog('document')} />
              {data.documents.map((document) => {
                const expired = document.expiresAt && new Date(document.expiresAt) < new Date();
                return (
                  <ItemCard key={document.id} onDelete={canEdit ? () => void remove('document', document.id) : undefined}>
                    <div>
                      <p className="font-bold text-white">{document.title}</p>
                      <p className={`mt-1 text-xs ${expired ? 'text-red-400' : 'text-neutral-500'}`}>
                        {document.number ? `№ ${document.number} · ` : ''}
                        {document.expiresAt ? `${expired ? 'Истёк' : 'Действует до'} ${new Date(document.expiresAt).toLocaleDateString('ru-RU')}` : 'Без срока действия'}
                      </p>
                    </div>
                  </ItemCard>
                );
              })}
              {data.documents.length === 0 && <Empty text="Документы пока не добавлены" />}
            </section>
          )}

          {tab === 'tires' && (
            <section className="space-y-4">
              <SectionHeader title="Комплекты шин" canAdd={canEdit} onAdd={() => setDialog('tire')} />
              <div className="grid gap-3 md:grid-cols-2">
                {data.tireSets.map((tire) => (
                  <ItemCard key={tire.id} onDelete={canEdit ? () => void remove('tire', tire.id) : undefined}>
                    <div>
                      <p className="font-bold text-white">{tire.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">{[tire.brand, tire.model, tire.size].filter(Boolean).join(' · ') || 'Характеристики не указаны'}</p>
                      <span className="mt-2 inline-block rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
                        {tire.status === 'installed' ? 'Установлены' : tire.status === 'storage' ? `На хранении${tire.storageLocation ? `: ${tire.storageLocation}` : ''}` : 'Списаны'}
                      </span>
                      {canEdit && tire.status !== 'retired' && (
                        <button
                          type="button"
                          onClick={() => void updateTireStatus(tire.id, tire.status === 'installed' ? 'storage' : 'installed')}
                          className="ml-2 mt-2 min-h-11 rounded-lg border border-neutral-700 px-3 text-xs font-bold text-neutral-200 hover:border-teal-500/40 hover:text-teal-300"
                        >
                          {tire.status === 'installed' ? 'Снять на хранение' : 'Установить'}
                        </button>
                      )}
                      <p className="mt-2 text-xs text-neutral-500">Учтённый пробег: {tire.totalDistance.toLocaleString('ru-RU')} км</p>
                    </div>
                  </ItemCard>
                ))}
              </div>
              {data.tireSets.length === 0 && <Empty text="Комплекты шин пока не добавлены" />}
            </section>
          )}

          {tab === 'sharing' && (
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-[#121214] p-5">
                <SectionHeader title="Совместный доступ" canAdd={data.role === 'owner'} onAdd={() => setDialog('member')} />
                <div className="mt-4 space-y-2">
                  {data.members.map((member) => (
                    <ItemCard key={member.id} onDelete={data.role === 'owner' ? () => void remove('member', member.id) : undefined}>
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-teal-400" />
                        <div>
                          <p className="font-bold text-white">{member.user.name || member.user.username}</p>
                          <p className="text-xs text-neutral-500">@{member.user.username} · {member.role === 'editor' ? 'Редактор' : 'Просмотр'}</p>
                        </div>
                      </div>
                    </ItemCard>
                  ))}
                  {data.members.length === 0 && <Empty text="Доступ никому не предоставлен" />}
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-[#121214] p-5">
                <h2 className="font-bold text-white">Экспорт и резервная копия</h2>
                <p className="mt-2 text-sm text-neutral-400">PDF для печати, CSV для таблиц и JSON для переноса данных.</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {(['pdf', 'csv', 'json'] as const).map((format) => (
                    <a key={format} href={`/api/vehicles/${vehicleId}/export?format=${format}`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-800 text-sm font-bold uppercase text-neutral-200 hover:border-teal-500/40 hover:bg-teal-500/10">
                      <FileArchive className="h-4 w-4" /> {format}
                    </a>
                  ))}
                </div>
                {data.role === 'owner' && (
                  <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 text-sm font-bold text-white hover:bg-neutral-700">
                    <Upload className="h-4 w-4" />
                    Импортировать JSON
                    <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importBackup(file);
                    }} />
                  </label>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {dialog === 'fuel' && (
        <OwnershipDialog title="Добавить заправку" onClose={() => setDialog(null)}>
          <form className="space-y-4 p-5" onSubmit={(event) => {
            event.preventDefault();
            void save('fuel', {
              ...fuelForm,
              mileage: Number(fuelForm.mileage),
              liters: Number(fuelForm.liters),
              totalCost: Number(fuelForm.totalCost),
              station: fuelForm.station || null,
              receiptUrl: fuelForm.receiptUrl || null,
              notes: fuelForm.notes || null,
            });
          }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Дата"><input required type="date" value={fuelForm.filledAt} onChange={(e) => setFuelForm({ ...fuelForm, filledAt: e.target.value })} className={inputClass} /></Field>
              <Field label="Пробег"><input required type="number" min="0" value={fuelForm.mileage} onChange={(e) => setFuelForm({ ...fuelForm, mileage: e.target.value })} className={inputClass} /></Field>
              <Field label="Литры"><input required type="number" min="0.001" step="0.001" inputMode="decimal" value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })} className={inputClass} /></Field>
              <Field label="Сумма"><input required type="number" min="0" step="0.01" inputMode="decimal" value={fuelForm.totalCost} onChange={(e) => setFuelForm({ ...fuelForm, totalCost: e.target.value })} className={inputClass} /></Field>
            </div>
            <Field label="Валюта"><select value={fuelForm.currency} onChange={(e) => setFuelForm({ ...fuelForm, currency: e.target.value as SupportedCurrency })} className={inputClass}>{SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{CURRENCY_LABELS[currency]}</option>)}</select></Field>
            <Field label="АЗС"><input value={fuelForm.station} onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })} className={inputClass} placeholder="Название станции" /></Field>
            <label className="flex min-h-11 items-center gap-3 text-sm text-neutral-300"><input type="checkbox" checked={fuelForm.fullTank} onChange={(e) => setFuelForm({ ...fuelForm, fullTank: e.target.checked })} className="h-5 w-5" /> Заправка до полного бака</label>
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 text-sm font-semibold text-neutral-300 hover:border-teal-500/50">
              <ScanLine className="h-4 w-4" /> {uploading ? 'Распознаём…' : fuelForm.receiptUrl ? 'Чек загружен' : 'Распознать фото чека'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploading} onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void recognizeReceipt(file);
              }} />
            </label>
            <SubmitButton saving={saving} />
          </form>
        </OwnershipDialog>
      )}

      {dialog === 'document' && (
        <OwnershipDialog title="Добавить документ" onClose={() => setDialog(null)}>
          <form className="space-y-4 p-5" onSubmit={(event) => {
            event.preventDefault();
            void save('document', {
              ...documentForm,
              number: documentForm.number || null,
              validFrom: documentForm.validFrom || null,
              expiresAt: documentForm.expiresAt || null,
              notes: documentForm.notes || null,
            });
          }}>
            <Field label="Тип"><select value={documentForm.type} onChange={(e) => setDocumentForm({ ...documentForm, type: e.target.value })} className={inputClass}><option value="insurance">Страховка</option><option value="inspection">Техосмотр</option><option value="tax">Налог</option><option value="warranty">Гарантия</option><option value="registration">Регистрация</option><option value="other">Другое</option></select></Field>
            <Field label="Название"><input required value={documentForm.title} onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })} className={inputClass} /></Field>
            <Field label="Номер"><input value={documentForm.number} onChange={(e) => setDocumentForm({ ...documentForm, number: e.target.value })} className={inputClass} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Действует с"><input type="date" value={documentForm.validFrom} onChange={(e) => setDocumentForm({ ...documentForm, validFrom: e.target.value })} className={inputClass} /></Field>
              <Field label="Действует до"><input type="date" value={documentForm.expiresAt} onChange={(e) => setDocumentForm({ ...documentForm, expiresAt: e.target.value })} className={inputClass} /></Field>
            </div>
            <SubmitButton saving={saving} />
          </form>
        </OwnershipDialog>
      )}

      {dialog === 'tire' && (
        <OwnershipDialog title="Добавить комплект шин" onClose={() => setDialog(null)}>
          <form className="space-y-4 p-5" onSubmit={(event) => {
            event.preventDefault();
            void save('tire', {
              ...tireForm,
              brand: tireForm.brand || null,
              model: tireForm.model || null,
              size: tireForm.size || null,
              storageLocation: tireForm.storageLocation || null,
              installedMileage: tireForm.installedMileage ? Number(tireForm.installedMileage) : null,
              totalDistance: Number(tireForm.totalDistance),
              notes: tireForm.notes || null,
            });
          }}>
            <Field label="Название"><input required value={tireForm.name} onChange={(e) => setTireForm({ ...tireForm, name: e.target.value })} className={inputClass} placeholder="Зимний комплект" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Сезон"><select value={tireForm.season} onChange={(e) => setTireForm({ ...tireForm, season: e.target.value })} className={inputClass}><option value="summer">Лето</option><option value="winter">Зима</option><option value="all_season">Всесезонные</option></select></Field>
              <Field label="Статус"><select value={tireForm.status} onChange={(e) => setTireForm({ ...tireForm, status: e.target.value })} className={inputClass}><option value="storage">На хранении</option><option value="installed">Установлены</option><option value="retired">Списаны</option></select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Бренд"><input value={tireForm.brand} onChange={(e) => setTireForm({ ...tireForm, brand: e.target.value })} className={inputClass} /></Field>
              <Field label="Модель"><input value={tireForm.model} onChange={(e) => setTireForm({ ...tireForm, model: e.target.value })} className={inputClass} /></Field>
              <Field label="Размер"><input value={tireForm.size} onChange={(e) => setTireForm({ ...tireForm, size: e.target.value })} className={inputClass} placeholder="205/55 R16" /></Field>
              <Field label="Место хранения"><input value={tireForm.storageLocation} onChange={(e) => setTireForm({ ...tireForm, storageLocation: e.target.value })} className={inputClass} /></Field>
            </div>
            <SubmitButton saving={saving} />
          </form>
        </OwnershipDialog>
      )}

      {dialog === 'member' && (
        <OwnershipDialog title="Предоставить доступ" onClose={() => setDialog(null)}>
          <form className="space-y-4 p-5" onSubmit={(event) => {
            event.preventDefault();
            void save('member', memberForm);
          }}>
            <Field label="Логин пользователя"><input required value={memberForm.username} onChange={(e) => setMemberForm({ ...memberForm, username: e.target.value })} className={inputClass} placeholder="username" /></Field>
            <Field label="Права"><select value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} className={inputClass}><option value="viewer">Только просмотр</option><option value="editor">Редактирование</option></select></Field>
            <SubmitButton saving={saving} />
          </form>
        </OwnershipDialog>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-[#121214] p-4"><p className="text-xs font-semibold uppercase text-neutral-500">{label}</p><p className="mt-2 text-lg font-black text-white">{value}</p></div>;
}

function SectionHeader({ title, canAdd, onAdd }: { title: string; canAdd?: boolean; onAdd: () => void }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-white">{title}</h2>{canAdd && <button type="button" onClick={onAdd} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-500 px-4 text-sm font-bold text-black hover:bg-teal-400"><Plus className="h-4 w-4" /> Добавить</button>}</div>;
}

function ItemCard({ children, onDelete }: { children: React.ReactNode; onDelete?: () => void }) {
  return <div className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-[#121214] p-4">{children}{onDelete && <button type="button" onClick={onDelete} aria-label="Удалить запись" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className={labelClass}>{label}</span>{children}</label>;
}

function SubmitButton({ saving }: { saving: boolean }) {
  return <button type="submit" disabled={saving} className="min-h-11 w-full rounded-lg bg-teal-500 px-5 text-sm font-bold text-black hover:bg-teal-400 disabled:opacity-50">{saving ? 'Сохраняем…' : 'Сохранить'}</button>;
}
