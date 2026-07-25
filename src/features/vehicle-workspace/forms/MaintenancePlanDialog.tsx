'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { maintenancePlanSchema } from '@/lib/validation';
import type { Category } from '../types';
import { jsonRequest, requestWorkspaceApi, type FieldErrors } from '../api/client';
import { fieldErrorsFromRequest, fieldErrorsFromZod } from './formUtils';
import { WorkspaceDialog } from '../components/WorkspaceDialog';

type ScheduleMode = 'date_only' | 'mileage_only' | 'whichever_comes_first' | 'manual';

interface MaintenancePlanDialogProps {
  vehicleId: string;
  categories: Category[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function MaintenancePlanDialog({
  vehicleId,
  categories,
  onClose,
  onSaved,
}: MaintenancePlanDialogProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    categoryId: categories[0]?.id ?? '',
    title: '',
    description: '',
    kind: 'scheduled_service' as 'scheduled_service' | 'inspection' | 'observation' | 'document',
    priority: 'normal' as 'normal' | 'high' | 'critical',
    scheduleMode: 'whichever_comes_first' as ScheduleMode,
    intervalDays: 365,
    intervalMileage: 10000,
    soonDaysThreshold: 30,
    soonMileageThreshold: 1000,
    watchDaysThreshold: 90,
    watchMileageThreshold: 3000,
    manualDueAt: '',
    manualDueMileage: '',
    manualStatus: 'auto' as 'auto' | 'watch' | 'resolved',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});

    const hasDateInterval =
      formData.scheduleMode === 'date_only' ||
      formData.scheduleMode === 'whichever_comes_first';
    const hasMileageInterval =
      formData.scheduleMode === 'mileage_only' ||
      formData.scheduleMode === 'whichever_comes_first';
    const payload = {
      ...formData,
      intervalDays: hasDateInterval ? Number(formData.intervalDays) : null,
      intervalMileage: hasMileageInterval ? Number(formData.intervalMileage) : null,
      manualDueAt:
        formData.scheduleMode === 'manual' && formData.manualDueAt
          ? formData.manualDueAt
          : null,
      manualDueMileage:
        formData.scheduleMode === 'manual' && formData.manualDueMileage
          ? Number(formData.manualDueMileage)
          : null,
    };

    const parsed = maintenancePlanSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    try {
      setIsSubmitting(true);
      await requestWorkspaceApi(
        `/api/vehicles/${vehicleId}/plans`,
        jsonRequest('POST', payload)
      );
      await onSaved();
      showToast('План ТО успешно добавлен', 'success');
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFromRequest(error, 'Сетевая ошибка при создании плана ТО'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showDateInterval =
    formData.scheduleMode === 'date_only' ||
    formData.scheduleMode === 'whichever_comes_first';
  const showMileageInterval =
    formData.scheduleMode === 'mileage_only' ||
    formData.scheduleMode === 'whichever_comes_first';

  return (
    <WorkspaceDialog title="Новый план обслуживания" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
        {errors.general && (
          <div role="alert" className="rounded border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-medium text-red-400">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="plan-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Название ТО / Работы <span className="text-teal-400">*</span>
          </label>
          <input
            id="plan-title"
            type="text"
            value={formData.title}
            onChange={(event) =>
              setFormData((current) => ({ ...current, title: event.target.value }))
            }
            aria-invalid={Boolean(errors.title)}
            placeholder="Замена масла в ДВС, замена передних колодок..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan-category" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Категория <span className="text-teal-400">*</span>
            </label>
            <select
              id="plan-category"
              value={formData.categoryId}
              onChange={(event) =>
                setFormData((current) => ({ ...current, categoryId: event.target.value }))
              }
              aria-invalid={Boolean(errors.categoryId)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              {categories.length === 0 && <option value="">Нет категорий</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="mt-1 text-xs text-red-400">{errors.categoryId}</p>}
          </div>
          <div>
            <label htmlFor="plan-kind" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Тип работы
            </label>
            <select
              id="plan-kind"
              value={formData.kind}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  kind: event.target.value as typeof current.kind,
                }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              <option value="scheduled_service">Регулярное ТО</option>
              <option value="inspection">Инспекция / Осмотр</option>
              <option value="observation">Наблюдение</option>
              <option value="document">Документы</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan-priority" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Приоритет
            </label>
            <select
              id="plan-priority"
              value={formData.priority}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  priority: event.target.value as typeof current.priority,
                }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
              <option value="critical">Критический</option>
            </select>
          </div>
          <div>
            <label htmlFor="plan-schedule-mode" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-teal-400">
              Режим расчета срока <span className="text-teal-400">*</span>
            </label>
            <select
              id="plan-schedule-mode"
              value={formData.scheduleMode}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  scheduleMode: event.target.value as ScheduleMode,
                }))
              }
              aria-invalid={Boolean(errors.scheduleMode)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="whichever_comes_first">Что наступит раньше</option>
              <option value="date_only">Только по дате</option>
              <option value="mileage_only">Только по пробегу</option>
              <option value="manual">Ручной ввод срока</option>
            </select>
            {errors.scheduleMode && <p className="mt-1 text-xs text-red-400">{errors.scheduleMode}</p>}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          {showDateInterval && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="plan-interval-days" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Интервал (дней) <span className="text-teal-400">*</span>
                </label>
                <input
                  id="plan-interval-days"
                  type="number"
                  min="1"
                  value={formData.intervalDays}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      intervalDays: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-sm text-white"
                />
                {errors.intervalDays && <p className="mt-1 text-xs text-red-400">{errors.intervalDays}</p>}
              </div>
              <div>
                <label htmlFor="plan-soon-days" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Порог «Скоро» (дней)
                </label>
                <input
                  id="plan-soon-days"
                  type="number"
                  min="0"
                  value={formData.soonDaysThreshold}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      soonDaysThreshold: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-sm text-white"
                />
              </div>
            </div>
          )}

          {showMileageInterval && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="plan-interval-mileage" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Интервал пробега (км) <span className="text-teal-400">*</span>
                </label>
                <input
                  id="plan-interval-mileage"
                  type="number"
                  min="1"
                  value={formData.intervalMileage}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      intervalMileage: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-sm text-white"
                />
                {errors.intervalMileage && <p className="mt-1 text-xs text-red-400">{errors.intervalMileage}</p>}
              </div>
              <div>
                <label htmlFor="plan-soon-mileage" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Порог «Скоро» (км)
                </label>
                <input
                  id="plan-soon-mileage"
                  type="number"
                  min="0"
                  value={formData.soonMileageThreshold}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      soonMileageThreshold: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-sm text-white"
                />
              </div>
            </div>
          )}

          {formData.scheduleMode === 'manual' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="plan-manual-date" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Срок по дате
                </label>
                <input
                  id="plan-manual-date"
                  type="date"
                  value={formData.manualDueAt}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, manualDueAt: event.target.value }))
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label htmlFor="plan-manual-mileage" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Срок по пробегу (км)
                </label>
                <input
                  id="plan-manual-mileage"
                  type="number"
                  min="0"
                  value={formData.manualDueMileage}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      manualDueMileage: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-sm text-white"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="plan-description" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Описание плана
          </label>
          <textarea
            id="plan-description"
            value={formData.description}
            onChange={(event) =>
              setFormData((current) => ({ ...current, description: event.target.value }))
            }
            rows={2}
            placeholder="Дополнительные примечания к работе..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-900 pt-4">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-50">
            Отмена
          </button>
          <button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-teal-400 disabled:opacity-50">
            {isSubmitting ? 'Создание...' : 'Создать план'}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}
