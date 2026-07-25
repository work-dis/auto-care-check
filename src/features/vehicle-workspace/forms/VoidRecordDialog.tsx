'use client';

import { useState, type FormEvent } from 'react';
import { jsonRequest, requestWorkspaceApi, type FieldErrors } from '../api/client';
import { fieldErrorsFromRequest } from './formUtils';
import { WorkspaceDialog } from '../components/WorkspaceDialog';

interface VoidRecordDialogProps {
  recordId: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function VoidRecordDialog({ recordId, onClose, onSaved }: VoidRecordDialogProps) {
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});

    if (!reason.trim()) {
      setErrors({ voidReason: 'Укажите причину отмены работы' });
      return;
    }

    try {
      setIsSubmitting(true);
      await requestWorkspaceApi(
        `/api/records/${recordId}/void`,
        jsonRequest('POST', { voidReason: reason.trim() })
      );
      await onSaved();
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFromRequest(error, 'Сетевая ошибка при отмене записи'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <WorkspaceDialog title="Отменить запись обслуживания?" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <p className="text-xs leading-relaxed text-neutral-400">
          Выполненные работы будут помечены как «Отменено». Связанные сроки планов
          ТО будут автоматически пересчитаны по остальным записям.
        </p>

        {errors.general && (
          <div role="alert" className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="void-record-reason" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Причина отмены <span className="text-teal-400">*</span>
          </label>
          <input
            id="void-record-reason"
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(errors.voidReason)}
            aria-describedby={errors.voidReason ? 'void-record-reason-error' : undefined}
            placeholder="Например: ошибочный ввод"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white"
            required
          />
          {errors.voidReason && (
            <p id="void-record-reason-error" className="mt-1 text-xs text-red-400">
              {errors.voidReason}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-50">
            Отмена
          </button>
          <button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50">
            {isSubmitting ? 'Отмена...' : 'Да, отменить работу'}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}
