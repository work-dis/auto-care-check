'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface WorkspaceDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  presentation?: 'dialog' | 'sheet';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

export function WorkspaceDialog({
  title,
  onClose,
  children,
  size = 'sm',
  presentation = 'dialog',
}: WorkspaceDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const sheetClasses =
    presentation === 'sheet'
      ? 'sm:rounded-2xl rounded-t-3xl sm:max-h-[85vh]'
      : 'rounded-t-2xl sm:rounded-2xl sm:max-h-[85vh]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-dialog-title"
        className={`relative flex max-h-[92vh] w-full flex-col border border-neutral-800 bg-[#121214] text-neutral-100 shadow-2xl ${sizeClasses[size]} ${sheetClasses}`}
      >
        <header className="flex items-center justify-between border-b border-neutral-900 px-6 py-4">
          <h2 id="workspace-dialog-title" className="text-lg font-bold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть диалог"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
