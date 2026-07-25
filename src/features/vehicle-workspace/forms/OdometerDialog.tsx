'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { odometerSchema } from '@/lib/validation';
import type { Vehicle } from '../types';
import { jsonRequest, requestWorkspaceApi, type FieldErrors } from '../api/client';
import {
  fieldErrorsFromRequest,
  fieldErrorsFromZod,
  todayInputValue,
} from './formUtils';
import { WorkspaceDialog } from '../components/WorkspaceDialog';

interface OdometerDialogProps {
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function OdometerDialog({ vehicle, onClose, onSaved }: OdometerDialogProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    mileage: vehicle.currentMileage,
    source: 'manual' as 'manual' | 'correction' | 'service_record' | 'import',
    comment: '',
    recordedAt: todayInputValue(),
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDecrease = formData.mileage < vehicle.currentMileage;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});

    const parsed = odometerSchema.safeParse(formData);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    if (isDecrease && (formData.source !== 'correction' || !formData.comment.trim())) {
      setErrors({
        mileage:
          'Уменьшение пробега допускается только как «Корректировка» с обязательным комментарием.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await requestWorkspaceApi(
        `/api/vehicles/${vehicle.id}/odometer`,
        jsonRequest('POST', formData)
      );
      await onSaved();
      showToast('Пробег успешно обновлен', 'success');
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFromRequest(error, 'Сетевая ошибка при обновлении одометра'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <WorkspaceDialog title="Обновить пробег" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
        {errors.general && (
          <div role="alert" className="rounded border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="odometer-mileage" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Новый пробег ({vehicle.mileageUnit}) <span className="text-teal-400">*</span>
          </label>
          <input
            id="odometer-mileage"
            type="number"
            value={formData.mileage}
            onChange={(event) =>
              setFormData((current) => ({ ...current, mileage: Number(event.target.value) }))
            }
            aria-invalid={Boolean(errors.mileage)}
            aria-describedby={errors.mileage ? 'odometer-mileage-error' : undefined}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          {errors.mileage && (
            <p id="odometer-mileage-error" className="mt-1.5 text-xs leading-tight text-red-400">
              {errors.mileage}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="odometer-source" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Тип записи
            </label>
            <select
              id="odometer-source"
              value={formData.source}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  source: event.target.value as typeof current.source,
                }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              <option value="manual">Вручную</option>
              <option value="service_record">На сервисе</option>
              <option value="correction">Корректировка</option>
              <option value="import">Импорт данных</option>
            </select>
          </div>
          <div>
            <label htmlFor="odometer-date" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Дата записи
            </label>
            <input
              id="odometer-date"
              type="date"
              value={formData.recordedAt}
              onChange={(event) =>
                setFormData((current) => ({ ...current, recordedAt: event.target.value }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {isDecrease && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <span className="mb-0.5 block font-semibold">Внимание: уменьшение пробега</span>
              Выберите тип «Корректировка» и укажите причину.
            </div>
          </div>
        )}

        <div>
          <label htmlFor="odometer-comment" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Комментарий / Причина {isDecrease && <span className="text-amber-400">*</span>}
          </label>
          <input
            id="odometer-comment"
            type="text"
            value={formData.comment}
            onChange={(event) =>
              setFormData((current) => ({ ...current, comment: event.target.value }))
            }
            placeholder={isDecrease ? 'Укажите причину снижения пробега' : 'По желанию'}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-900 pt-4">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-50">
            Отмена
          </button>
          <button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-teal-400 disabled:opacity-50">
            {isSubmitting ? 'Сохранение...' : 'Обновить'}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}
