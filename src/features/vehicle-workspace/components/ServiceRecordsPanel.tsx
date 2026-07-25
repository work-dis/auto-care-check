import { FileClock } from 'lucide-react';
import type { ServiceRecord } from '../types';

export function ServiceRecordsPanel({
  records,
  onVoid,
}: {
  records: ServiceRecord[];
  onVoid: (recordId: string) => void;
}) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-[#121214]/30 p-10 text-center">
        <FileClock className="mb-3 h-10 w-10 text-neutral-500" />
        <h2 className="text-sm font-semibold text-neutral-300">История обслуживания пуста</h2>
        <p className="mt-1 max-w-sm text-xs text-neutral-400">
          Внесите первую запись о выполненном обслуживании, чтобы следить за историей затрат.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => {
        const isVoided = record.state === 'voided';
        return (
          <article
            key={record.id}
            className={`flex flex-col gap-4 rounded-xl border border-neutral-800 bg-[#121214] p-5 shadow-md ${
              isVoided ? 'opacity-55' : ''
            }`}
          >
            <header className="flex flex-col gap-2 border-b border-neutral-900 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-bold text-white ${isVoided ? 'line-through' : ''}`}>
                    {record.serviceName}
                  </h2>
                  {isVoided && (
                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">
                      Отменено
                    </span>
                  )}
                </div>
                <time className="text-[10px] text-neutral-500">
                  {new Date(record.performedAt).toLocaleDateString('ru-RU')}
                </time>
              </div>
              <span className="text-sm font-bold text-teal-400">
                {Number(record.totalCost).toLocaleString('ru-RU')}{' '}
                {record.currency === 'RUB' ? '₽' : record.currency}
              </span>
            </header>

            <dl className="grid grid-cols-2 gap-4 text-xs text-neutral-400">
              <RecordField label="Пробег" value={`${record.mileage.toLocaleString()} км`} mono />
              {record.serviceContact && <RecordField label="Место / СТО" value={record.serviceContact} />}
              <RecordField
                label="Стоимость"
                value={`Раб.: ${Number(record.laborCost).toLocaleString()} ₽ / Запч.: ${Number(record.partsCost).toLocaleString()} ₽`}
              />
              {record.planItems.length > 0 && (
                <div>
                  <dt className="mb-1 text-[10px] font-semibold uppercase text-neutral-500">
                    Выполненные задачи
                  </dt>
                  <dd className="flex flex-wrap gap-1">
                    {record.planItems.map((item) => (
                      <span key={item.id} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] text-neutral-400">
                        {item.titleSnapshot}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {record.notes && (
              <p className="rounded-lg border border-neutral-900 bg-neutral-950/40 p-3 text-xs text-neutral-400">
                <strong>Заметки:</strong> {record.notes}
              </p>
            )}
            {isVoided && record.voidReason && (
              <p className="rounded-lg border border-red-500/10 bg-red-500/5 p-3 text-xs text-red-400">
                <strong>Причина отмены:</strong> {record.voidReason}
              </p>
            )}
            {!isVoided && (
              <footer className="flex justify-end border-t border-neutral-900/50 pt-2">
                <button
                  type="button"
                  onClick={() => onVoid(record.id)}
                  className="min-h-11 rounded-lg border border-red-500/15 bg-red-500/5 px-3 text-xs font-bold text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                >
                  Отменить запись
                </button>
              </footer>
            )}
          </article>
        );
      })}
    </div>
  );
}

function RecordField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">{label}</dt>
      <dd className={mono ? 'font-mono text-white' : 'text-white'}>{value}</dd>
    </div>
  );
}
