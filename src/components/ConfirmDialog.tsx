'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  isBusy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Подтвердить',
  destructive = false,
  isBusy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBusy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-t-2xl border border-neutral-800 bg-[#121214] p-6 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2 ${destructive ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-white">{title}</h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-relaxed text-neutral-400">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Закрыть"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="min-h-11 rounded-lg border border-neutral-800 px-4 text-sm font-semibold text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`min-h-11 rounded-lg px-4 text-sm font-bold disabled:opacity-50 ${
              destructive
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-teal-500 text-black hover:bg-teal-400'
            }`}
          >
            {isBusy ? 'Выполняем…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
