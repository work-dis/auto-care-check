import { AlertTriangle, Plus } from 'lucide-react';
import type { Observation } from '../types';

export function ObservationsPanel({
  observations,
  onAdd,
  onClose,
  onEdit,
  onDelete,
}: {
  observations: Observation[];
  onAdd: () => void;
  onClose: (id: string) => void;
  onEdit: (observation: Observation) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Наблюдения</h2>
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-teal-500 px-4 text-xs font-semibold text-black transition hover:bg-teal-400"
        >
          <Plus className="h-4 w-4" /> Добавить симптом
        </button>
      </div>

      {observations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-[#121214]/30 p-10 text-center">
          <AlertTriangle className="mb-3 h-10 w-10 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-300">Нет зафиксированных симптомов</h3>
          <p className="mt-1 max-w-sm text-xs text-neutral-400">
            Запишите замеченные неисправности, чтобы не забыть проверить их.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {observations.map((observation) => (
            <ObservationCard
              key={observation.id}
              observation={observation}
              onClose={onClose}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ObservationCard({
  observation,
  onClose,
  onEdit,
  onDelete,
}: {
  observation: Observation;
  onClose: (id: string) => void;
  onEdit: (observation: Observation) => void;
  onDelete: (id: string) => void;
}) {
  const priorityStyles = {
    normal: 'border-neutral-800 bg-neutral-800/40 text-neutral-400',
    high: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    critical: 'border-red-500/20 bg-red-500/10 text-red-400',
  };
  const states = {
    open: ['Открыто', 'border-blue-500/20 bg-blue-500/10 text-blue-400'],
    watching: ['Под наблюдением', 'border-amber-500/20 bg-amber-500/10 text-amber-400'],
    service_planned: ['Запланирован ремонт', 'border-purple-500/20 bg-purple-500/10 text-purple-400'],
    closed: ['Решено', 'border-teal-500/20 bg-teal-500/10 text-teal-400'],
  } as const;
  const [stateLabel, stateStyles] = states[observation.state];
  const isClosed = observation.state === 'closed';

  return (
    <article className={`flex flex-col justify-between rounded-xl border border-neutral-800 bg-[#121214] p-5 ${isClosed ? 'opacity-60' : ''}`}>
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${priorityStyles[observation.priority]}`}>
            {observation.priority === 'critical' ? 'Критичный' : observation.priority === 'high' ? 'Высокий' : 'Обычный'}
          </span>
          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${stateStyles}`}>
            {stateLabel}
          </span>
        </div>
        <h3 className={`text-sm font-bold text-white ${isClosed ? 'line-through text-neutral-400' : ''}`}>
          {observation.title}
        </h3>
        {observation.description && <p className="mt-1 text-xs text-neutral-400">{observation.description}</p>}
        {observation.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={observation.photoUrl} alt={observation.title} className="mt-3 max-h-40 w-full rounded-lg border border-neutral-800 object-cover" />
        )}
        <div className="mt-3 flex flex-col gap-1 border-t border-neutral-900 pt-2 text-[10px] text-neutral-500">
          <span>Создано: {new Date(observation.createdAt).toLocaleDateString()}</span>
          {observation.maintenancePlan && <span className="text-teal-400">План: {observation.maintenancePlan.title}</span>}
          {observation.serviceRecord && <span className="text-teal-500">Решено в ТО: {observation.serviceRecord.serviceName}</span>}
        </div>
      </div>
      <footer className="mt-4 flex flex-wrap justify-end gap-2 border-t border-neutral-900/60 pt-2">
        {!isClosed && (
          <>
            <ActionButton onClick={() => onClose(observation.id)} tone="teal">Решено</ActionButton>
            <ActionButton onClick={() => onEdit(observation)} tone="neutral">Изменить</ActionButton>
          </>
        )}
        <ActionButton onClick={() => onDelete(observation.id)} tone="red">Удалить</ActionButton>
      </footer>
    </article>
  );
}

function ActionButton({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: 'teal' | 'neutral' | 'red';
}) {
  const styles = {
    teal: 'border-teal-500/15 bg-teal-500/5 text-teal-400 hover:bg-teal-500/10',
    neutral: 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:bg-neutral-800',
    red: 'border-red-500/15 bg-red-500/5 text-red-400 hover:bg-red-500/10',
  };
  return (
    <button type="button" onClick={onClick} className={`min-h-11 rounded border px-3 text-[10px] font-bold transition ${styles[tone]}`}>
      {children}
    </button>
  );
}
