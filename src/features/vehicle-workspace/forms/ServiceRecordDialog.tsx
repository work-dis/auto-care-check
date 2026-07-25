'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { serviceRecordSchema } from '@/lib/validation';
import type { MaintenancePlan, Observation, Vehicle } from '../types';
import { jsonRequest, requestWorkspaceApi, type FieldErrors } from '../api/client';
import {
  fieldErrorsFromRequest,
  fieldErrorsFromZod,
  todayInputValue,
} from './formUtils';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import {
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '@/domain/money/currencies';

interface ServiceRecordDialogProps {
  vehicle: Vehicle;
  plans: MaintenancePlan[];
  observations: Observation[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function ServiceRecordDialog({
  vehicle,
  plans,
  observations,
  onClose,
  onSaved,
}: ServiceRecordDialogProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    performedAt: todayInputValue(),
    mileage: '' as number | '',
    serviceName: '',
    serviceContact: '',
    laborCost: 0,
    partsCost: 0,
    currency: 'RUB' as SupportedCurrency,
    notes: '',
    planIds: [] as string[],
    observationIds: [] as string[],
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const openObservations = observations.filter((observation) => observation.state !== 'closed');

  const toggleId = (field: 'planIds' | 'observationIds', id: string, checked: boolean) => {
    setFormData((current) => ({
      ...current,
      [field]: checked
        ? [...current[field], id]
        : current[field].filter((currentId) => currentId !== id),
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});

    const payload = {
      ...formData,
      mileage: Number(formData.mileage),
      laborCost: Number(formData.laborCost),
      partsCost: Number(formData.partsCost),
    };
    const parsed = serviceRecordSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    if (payload.mileage < vehicle.currentMileage) {
      setErrors({
        mileage: `Пробег не может быть меньше текущего (${vehicle.currentMileage.toLocaleString()} ${vehicle.mileageUnit})`,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await requestWorkspaceApi(
        `/api/vehicles/${vehicle.id}/records`,
        jsonRequest('POST', payload)
      );
      await onSaved();
      showToast('Запись о ТО сохранена', 'success');
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFromRequest(error, 'Сетевая ошибка при сохранении записи'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <WorkspaceDialog title="Внести запись о ТО" onClose={onClose} size="lg" presentation="sheet">
      <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-6">
        {errors.general && (
          <div role="alert" className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
            {errors.general}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="record-date" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Дата выполнения <span className="text-teal-400">*</span>
            </label>
            <input
              id="record-date"
              type="date"
              value={formData.performedAt}
              onChange={(event) =>
                setFormData((current) => ({ ...current, performedAt: event.target.value }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white"
              required
            />
            {errors.performedAt && <p className="mt-1 text-xs text-red-400">{errors.performedAt}</p>}
          </div>
          <div>
            <label htmlFor="record-mileage" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Пробег ({vehicle.mileageUnit}) <span className="text-teal-400">*</span>
            </label>
            <input
              id="record-mileage"
              type="number"
              value={formData.mileage}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  mileage: event.target.value === '' ? '' : Number(event.target.value),
                }))
              }
              aria-invalid={Boolean(errors.mileage)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white"
              required
            />
            {errors.mileage && <p className="mt-1 text-xs text-red-400">{errors.mileage}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="record-service-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Название выполненной работы <span className="text-teal-400">*</span>
          </label>
          <input
            id="record-service-name"
            type="text"
            value={formData.serviceName}
            onChange={(event) =>
              setFormData((current) => ({ ...current, serviceName: event.target.value }))
            }
            aria-invalid={Boolean(errors.serviceName)}
            placeholder="Например: замена моторного масла и фильтра"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white"
            required
          />
          {errors.serviceName && <p className="mt-1 text-xs text-red-400">{errors.serviceName}</p>}
        </div>

        <div>
          <label htmlFor="record-service-contact" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Место обслуживания / СТО
          </label>
          <input
            id="record-service-contact"
            type="text"
            value={formData.serviceContact}
            onChange={(event) =>
              setFormData((current) => ({ ...current, serviceContact: event.target.value }))
            }
            placeholder="Например: СТО Рено-Сервис"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="record-currency" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Валюта расходов
          </label>
          <select
            id="record-currency"
            value={formData.currency}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                currency: event.target.value as SupportedCurrency,
              }))
            }
            className="min-h-11 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white"
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {CURRENCY_LABELS[currency]}
              </option>
            ))}
          </select>
          {errors.currency && <p className="mt-1 text-xs text-red-400">{errors.currency}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="record-labor-cost" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Стоимость работ ({formData.currency})
            </label>
            <input
              id="record-labor-cost"
              type="number"
              min="0"
              value={formData.laborCost}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  laborCost: Number(event.target.value),
                }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white"
            />
            {errors.laborCost && <p className="mt-1 text-xs text-red-400">{errors.laborCost}</p>}
          </div>
          <div>
            <label htmlFor="record-parts-cost" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Стоимость запчастей ({formData.currency})
            </label>
            <input
              id="record-parts-cost"
              type="number"
              min="0"
              value={formData.partsCost}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  partsCost: Number(event.target.value),
                }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white"
            />
            {errors.partsCost && <p className="mt-1 text-xs text-red-400">{errors.partsCost}</p>}
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Выполненные регламентные планы
          </legend>
          {plans.length === 0 ? (
            <p className="text-xs italic text-neutral-500">Нет планов ТО для привязки</p>
          ) : (
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              {plans.map((plan) => (
                <label key={plan.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.planIds.includes(plan.id)}
                    onChange={(event) => toggleId('planIds', plan.id, event.target.checked)}
                    className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-teal-500 focus:ring-teal-500"
                  />
                  <span>
                    <span className="block font-semibold leading-tight text-white">{plan.title}</span>
                    <span className="text-[11px] text-teal-400">{plan.category.name}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Устранённые наблюдения
          </legend>
          {openObservations.length === 0 ? (
            <p className="text-xs italic text-neutral-500">Нет открытых наблюдений</p>
          ) : (
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              {openObservations.map((observation) => (
                <label key={observation.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.observationIds.includes(observation.id)}
                    onChange={(event) =>
                      toggleId('observationIds', observation.id, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-teal-500 focus:ring-teal-500"
                  />
                  <span>
                    <span className="block font-semibold leading-tight text-white">{observation.title}</span>
                    <span className="text-[11px] text-amber-400">
                      Приоритет:{' '}
                      {observation.priority === 'critical'
                        ? 'Критичный'
                        : observation.priority === 'high'
                          ? 'Высокий'
                          : 'Обычный'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div>
          <label htmlFor="record-notes" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Заметки / Описание работ
          </label>
          <textarea
            id="record-notes"
            value={formData.notes}
            onChange={(event) =>
              setFormData((current) => ({ ...current, notes: event.target.value }))
            }
            rows={3}
            placeholder="Перечислите замененные запчасти, артикулы или другие детали..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-50">
            Отмена
          </button>
          <button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-teal-400 disabled:opacity-50">
            {isSubmitting ? 'Сохранение...' : 'Сохранить запись'}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}
