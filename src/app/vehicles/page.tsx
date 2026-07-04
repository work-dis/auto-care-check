'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Car, Trash2, Calendar, Gauge, AlertTriangle, X } from 'lucide-react';
import { vehicleSchema } from '@/lib/validation';
import { useToast } from '@/components/ToastProvider';

interface Vehicle {
  id: string;
  displayName: string;
  make: string;
  model: string;
  year: number;
  currentMileage: number;
  mileageUnit: string;
  plateNumberEncryptedOrMasked: string | null;
  vinEncryptedOrMasked: string | null;
  fuelType: string | null;
  transmission: string | null;
  engineDescription: string | null;
  notes: string | null;
}

export default function VehiclesPage() {
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    displayName: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    currentMileage: 0,
    mileageUnit: 'km' as 'km' | 'mi',
    plateNumberEncryptedOrMasked: '',
    vinEncryptedOrMasked: '',
    fuelType: '',
    transmission: '',
    engineDescription: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch vehicles
  const fetchVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles');
      const data = await res.json();
      if (res.ok) {
        setVehicles(data.vehicles);
      } else {
        setApiError(data.error?.message || 'Не удалось загрузить список автомобилей');
      }
    } catch (err) {
      console.error(err);
      setApiError('Сетевая ошибка при загрузке автомобилей');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVehicles();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'year' || name === 'currentMileage' ? Number(value) : value,
    }));
    // Clear validation error on change
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setApiError(null);

    // Validate using Zod client-side
    const parsed = vehicleSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          displayName: '',
          make: '',
          model: '',
          year: new Date().getFullYear(),
          currentMileage: 0,
          mileageUnit: 'km',
          plateNumberEncryptedOrMasked: '',
          vinEncryptedOrMasked: '',
          fuelType: '',
          transmission: '',
          engineDescription: '',
          notes: '',
        });
        fetchVehicles();
        showToast('Автомобиль успешно добавлен', 'success');
      } else {
        setApiError(data.error?.message || 'Не удалось сохранить автомобиль');
        if (data.error?.fieldErrors) {
          setErrors(data.error.fieldErrors);
        }
      }
    } catch (err) {
      console.error(err);
      setApiError('Сетевая ошибка при сохранении автомобиля');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: string, name: string) => {
    // Use inline confirm via state instead of browser confirm()
    if (archivingId === id) {
      // Second click = confirmed
      setArchivingId(null);
      try {
        const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchVehicles();
          showToast(`Автомобиль «${name}» отправлен в архив`, 'info');
        } else {
          const data = await res.json();
          showToast(data.error?.message || 'Не удалось архивировать автомобиль', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Сетевая ошибка при архивации', 'error');
      }
    } else {
      // First click = ask confirmation inline
      setArchivingId(id);
      setTimeout(() => setArchivingId(null), 5000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Мой гараж</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Управляйте своими транспортными средствами и следите за их пробегом.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/10 self-start sm:self-auto"
        >
          <Plus className="h-4.5 w-4.5" />
          Добавить автомобиль
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Vehicles Grid */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-neutral-900 bg-[#121214] animate-pulse"
            />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 p-12 text-center bg-[#121214]/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 text-neutral-400 mb-4">
            <Car className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Нет автомобилей в гараже</h3>
          <p className="mt-1 text-sm text-neutral-400 max-w-sm">
            Добавьте свой первый автомобиль, чтобы начать планировать его техническое обслуживание.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-6 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors"
          >
            Добавить сейчас
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-800/80 bg-[#121214] p-6 hover:border-neutral-700 transition-all duration-300"
            >
              {/* Top Row info */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <Link href={`/vehicles/${v.id}`} className="hover:underline">
                    <h3 className="text-lg font-bold text-white group-hover:text-teal-400 transition-colors">
                      {v.displayName}
                    </h3>
                  </Link>
                  {archivingId === v.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-red-400 font-medium">Удалить?</span>
                      <button
                        onClick={() => handleArchive(v.id, v.displayName)}
                        aria-label="Подтвердить архивацию"
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                      >
                        Да
                      </button>
                      <button
                        onClick={() => setArchivingId(null)}
                        aria-label="Отменить"
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleArchive(v.id, v.displayName)}
                      aria-label={`Архивировать автомобиль ${v.displayName}`}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400 transition-colors"
                      title="В архив"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-neutral-400">
                  {v.make} {v.model}
                </p>

                {/* Specs badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {v.fuelType && (
                    <span className="rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                      {v.fuelType}
                    </span>
                  )}
                  {v.transmission && (
                    <span className="rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                      {v.transmission}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom stats row */}
              <div className="mt-6 flex items-center justify-between border-t border-neutral-900 pt-4">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Calendar className="h-4 w-4 text-neutral-500" />
                  <span className="text-xs">{v.year} г.в.</span>
                </div>

                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-teal-500" />
                  <span className="font-mono text-sm font-semibold text-white tracking-tight">
                    {v.currentMileage.toLocaleString()} {v.mileageUnit}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modern responsive modal/sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          {/* Modal content wrapper */}
          <div className="relative flex max-h-[92vh] sm:max-h-[85vh] w-full max-w-xl flex-col rounded-t-2xl sm:rounded-2xl border border-neutral-800 bg-[#121214] text-neutral-100 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-900 px-6 py-4.5">
              <h2 className="text-lg font-bold text-white">Новый автомобиль</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form (scrollable) */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Display name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Название в системе <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder="Напр., Мой Camry или Семейный кроссовер"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                {errors.displayName && (
                  <p className="mt-1 text-xs text-red-400">{errors.displayName}</p>
                )}
              </div>

              {/* Grid 2 Columns for Make & Model */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Марка <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="make"
                    value={formData.make}
                    onChange={handleInputChange}
                    placeholder="Toyota"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {errors.make && <p className="mt-1 text-xs text-red-400">{errors.make}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Модель <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                    placeholder="Camry"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {errors.model && <p className="mt-1 text-xs text-red-400">{errors.model}</p>}
                </div>
              </div>

              {/* Grid 2 Columns for Year & Mileage */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Год выпуска <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {errors.year && <p className="mt-1 text-xs text-red-400">{errors.year}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Текущий пробег <span className="text-teal-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="currentMileage"
                      value={formData.currentMileage}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <select
                      name="mileageUnit"
                      value={formData.mileageUnit}
                      onChange={handleInputChange}
                      className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                    >
                      <option value="km">км</option>
                      <option value="mi">миль</option>
                    </select>
                  </div>
                  {errors.currentMileage && (
                    <p className="mt-1 text-xs text-red-400">{errors.currentMileage}</p>
                  )}
                </div>
              </div>

              {/* Extra details collapse header */}
              <div className="border-t border-neutral-900 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-teal-400 mb-3">
                  Дополнительные характеристики
                </h4>

                <div className="space-y-4">
                  {/* VIN & Plate Number */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Госномер
                      </label>
                      <input
                        type="text"
                        name="plateNumberEncryptedOrMasked"
                        value={formData.plateNumberEncryptedOrMasked}
                        onChange={handleInputChange}
                        placeholder="А123БВ777"
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                        VIN код
                      </label>
                      <input
                        type="text"
                        name="vinEncryptedOrMasked"
                        value={formData.vinEncryptedOrMasked}
                        onChange={handleInputChange}
                        placeholder="17 знаков"
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  {/* Fuel, Trans, Engine */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Топливо
                      </label>
                      <input
                        type="text"
                        name="fuelType"
                        value={formData.fuelType}
                        onChange={handleInputChange}
                        placeholder="Бензин / Дизель"
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                        КПП
                      </label>
                      <input
                        type="text"
                        name="transmission"
                        value={formData.transmission}
                        onChange={handleInputChange}
                        placeholder="Автомат / Механика"
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Двигатель
                      </label>
                      <input
                        type="text"
                        name="engineDescription"
                        value={formData.engineDescription}
                        onChange={handleInputChange}
                        placeholder="2.5л, 181 л.с."
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Заметки
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Любая важная информация об авто..."
                      rows={2.5}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-neutral-900 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
