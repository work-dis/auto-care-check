import Link from 'next/link';
import { ArrowLeft, Gauge, Plus } from 'lucide-react';
import type { Vehicle } from '../types';

interface Props {
  vehicle: Vehicle;
  activeTab: 'plans' | 'records' | 'observations';
  onOpenMileage: () => void;
  onOpenPlan: () => void;
  onOpenRecord: () => void;
}

export function VehicleOverviewHeader({
  vehicle,
  activeTab,
  onOpenMileage,
  onOpenPlan,
  onOpenRecord,
}: Props) {
  return (
    <>
      <div>
        <Link
          href="/vehicles"
          className="mb-3 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Вернуться в гараж
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {vehicle.displayName}
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenMileage}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              <Gauge className="h-5 w-5 text-teal-400" />
              Обновить пробег
            </button>
            <button
              type="button"
              onClick={activeTab === 'plans' ? onOpenPlan : onOpenRecord}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-teal-400"
            >
              <Plus className="h-5 w-5" />
              {activeTab === 'plans' ? 'Добавить план ТО' : 'Внести запись о ТО'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 md:col-span-1">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Текущий пробег
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-extrabold tabular-nums tracking-tight text-white">
                {vehicle.currentMileage.toLocaleString()}
              </span>
              <span className="text-sm font-semibold uppercase text-neutral-400">
                {vehicle.mileageUnit}
              </span>
            </div>
          </div>
          <p className="mt-4 border-t border-neutral-900 pt-3 text-xs text-neutral-400">
            Обновляйте пробег регулярно, чтобы получать своевременные оповещения.
          </p>
        </section>

        <section className="rounded-xl border border-neutral-800 bg-[#121214] p-6 md:col-span-2">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-teal-400">
            Технические данные
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <VehicleField label="Марка / Модель" value={`${vehicle.make} ${vehicle.model}`} />
            <VehicleField label="Год выпуска" value={`${vehicle.year} г.`} />
            <VehicleField label="Госномер" value={vehicle.plateNumberEncryptedOrMasked || 'Не указан'} />
            <VehicleField label="VIN номер" value={vehicle.vinEncryptedOrMasked || 'Не указан'} />
            <VehicleField label="Двигатель" value={vehicle.engineDescription || 'Не указан'} />
            <VehicleField
              label="КПП / Топливо"
              value={`${vehicle.transmission || '—'} / ${vehicle.fuelType || '—'}`}
            />
          </dl>
          {vehicle.notes && (
            <div className="mt-4 border-t border-neutral-900 pt-3">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-neutral-500">
                Заметки
              </span>
              <p className="text-xs text-neutral-300">{vehicle.notes}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function VehicleField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase text-neutral-500">{label}</dt>
      <dd className="truncate text-sm font-medium text-white" title={value}>{value}</dd>
    </div>
  );
}
