'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { observationSchema } from '@/lib/validation';
import type { MaintenancePlan, Observation } from '../types';
import { jsonRequest, requestWorkspaceApi, type FieldErrors } from '../api/client';
import { fieldErrorsFromRequest, fieldErrorsFromZod } from './formUtils';
import { WorkspaceDialog } from '../components/WorkspaceDialog';

interface ObservationDialogProps {
  vehicleId: string;
  plans: MaintenancePlan[];
  observation?: Observation | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function ObservationDialog({
  vehicleId,
  plans,
  observation,
  onClose,
  onSaved,
}: ObservationDialogProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    title: observation?.title ?? '',
    description: observation?.description ?? '',
    priority: observation?.priority ?? ('normal' as const),
    state: observation?.state ?? ('open' as const),
    photoUrl: observation?.photoUrl ?? '',
    maintenancePlanId: observation?.maintenancePlanId ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});

    const payload = {
      title: formData.title,
      description: formData.description || null,
      priority: formData.priority,
      state: formData.state,
      photoUrl: formData.photoUrl || null,
      maintenancePlanId: formData.maintenancePlanId || null,
    };
    const parsed = observationSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    try {
      setIsSubmitting(true);
      await requestWorkspaceApi(
        observation
          ? `/api/observations/${observation.id}`
          : `/api/vehicles/${vehicleId}/observations`,
        jsonRequest(observation ? 'PATCH' : 'POST', payload)
      );
      await onSaved();
      showToast(observation ? 'Наблюдение обновлено' : 'Наблюдение зафиксировано', 'success');
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFromRequest(error, 'Сетевая ошибка при сохранении наблюдения'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <WorkspaceDialog
      title={observation ? 'Редактировать симптом' : 'Добавить симптом в «Нужно проверить»'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
        {errors.general && (
          <div role="alert" className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="observation-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Название неисправности / Симптом <span className="text-teal-400">*</span>
          </label>
          <input
            id="observation-title"
            type="text"
            value={formData.title}
            onChange={(event) =>
              setFormData((current) => ({ ...current, title: event.target.value }))
            }
            aria-invalid={Boolean(errors.title)}
            placeholder="Например: скрип спереди справа при торможении"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            required
          />
          {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
        </div>

        <div>
          <label htmlFor="observation-description" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Описание симптомов и детали
          </label>
          <textarea
            id="observation-description"
            value={formData.description}
            onChange={(event) =>
              setFormData((current) => ({ ...current, description: event.target.value }))
            }
            rows={3}
            placeholder="Опишите подробнее: когда появляется звук, на какой скорости..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
          />
          {errors.description && <p className="mt-1 text-xs text-red-400">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="observation-priority" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Приоритет
            </label>
            <select
              id="observation-priority"
              value={formData.priority}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  priority: event.target.value as typeof current.priority,
                }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
              <option value="critical">Критичный</option>
            </select>
          </div>

          <div>
            <label htmlFor="observation-state" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Статус
            </label>
            <select
              id="observation-state"
              value={formData.state}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  state: event.target.value as typeof current.state,
                }))
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              <option value="open">Открыто</option>
              <option value="watching">Наблюдаю</option>
              <option value="service_planned">Запланирован визит</option>
              <option value="closed">Решено</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="observation-plan" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Связать с регламентным планом
          </label>
          <select
            id="observation-plan"
            value={formData.maintenancePlanId}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                maintenancePlanId: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
          >
            <option value="">Не связывать</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title} ({plan.category.name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="observation-photo" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Ссылка на фото
          </label>
          <input
            id="observation-photo"
            type="url"
            value={formData.photoUrl}
            onChange={(event) =>
              setFormData((current) => ({ ...current, photoUrl: event.target.value }))
            }
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
          />
          {errors.photoUrl && <p className="mt-1 text-xs text-red-400">{errors.photoUrl}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-900 pt-4">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-50">
            Отмена
          </button>
          <button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-teal-400 disabled:opacity-50">
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}
