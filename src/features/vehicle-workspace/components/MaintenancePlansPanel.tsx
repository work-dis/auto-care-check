import { Bell, Calendar, CheckCircle2, Eye, FileClock, FileText, Gauge, Trash2, Wrench } from 'lucide-react';
import type { MaintenancePlan, ReminderRule } from '../types';

interface Props {
  plans: MaintenancePlan[];
  reminderRules: ReminderRule[];
  currentMileage: number;
  nowMs: number;
  onArchive: (id: string, title: string) => void;
  onAddRule: (planId: string, triggerType: string, triggerValue: string) => void;
  onDeleteRule: (ruleId: string) => void;
  formatRule: (rule: ReminderRule) => string;
}

const STATUS = {
  overdue: { label: 'Просрочено', color: 'text-red-400', badge: 'bg-red-500/10 border-red-500/20', bar: 'bg-red-500' },
  soon: { label: 'Скоро', color: 'text-orange-400', badge: 'bg-orange-500/10 border-orange-500/20', bar: 'bg-orange-500' },
  watch: { label: 'Наблюдение', color: 'text-yellow-400', badge: 'bg-yellow-500/10 border-yellow-500/20', bar: 'bg-yellow-500' },
  normal: { label: 'В норме', color: 'text-teal-400', badge: 'bg-teal-500/10 border-teal-500/20', bar: 'bg-teal-500' },
  unknown: { label: 'Нет данных', color: 'text-neutral-400', badge: 'bg-neutral-800 border-neutral-700', bar: 'bg-neutral-500' },
  disabled: { label: 'Отключено', color: 'text-neutral-500', badge: 'bg-neutral-900 border-neutral-800', bar: 'bg-neutral-600' },
};

export function MaintenancePlansPanel(props: Props) {
  if (props.plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-[#121214]/30 p-10 text-center">
        <Wrench className="mb-3 h-10 w-10 text-neutral-500" />
        <h2 className="text-sm font-semibold text-neutral-300">Нет планов обслуживания</h2>
        <p className="mt-1 max-w-sm text-xs text-neutral-400">
          Создайте первую регламентную задачу, чтобы следить за её выполнением.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {props.plans.map((plan) => (
        <MaintenancePlanCard key={plan.id} plan={plan} {...props} />
      ))}
    </div>
  );
}

function MaintenancePlanCard({
  plan,
  reminderRules,
  currentMileage,
  nowMs,
  onArchive,
  onAddRule,
  onDeleteRule,
  formatRule,
}: Props & { plan: MaintenancePlan }) {
  const config = STATUS[plan.status ?? 'unknown'];
  const KindIcon =
    plan.kind === 'document' ? FileText :
    plan.kind === 'inspection' ? Eye :
    plan.kind === 'observation' ? CheckCircle2 : Wrench;

  const timeProgress =
    plan.lastCompletedAt && plan.nextDueAt && plan.intervalDays
      ? progress(new Date(plan.lastCompletedAt).getTime(), new Date(plan.nextDueAt).getTime(), nowMs)
      : null;
  const mileageProgress =
    plan.lastCompletedMileage != null && plan.nextDueMileage != null && plan.intervalMileage
      ? Math.min(100, Math.max(0, Math.round(
          ((currentMileage - plan.lastCompletedMileage) / plan.intervalMileage) * 100,
        )))
      : null;
  const rules = reminderRules.filter((rule) => rule.maintenancePlanId === plan.id);

  return (
    <article className={`rounded-xl border bg-[#121214] p-5 transition hover:border-neutral-700 ${
      plan.status === 'overdue' ? 'border-red-500/25' :
      plan.status === 'soon' ? 'border-orange-500/20' : 'border-neutral-800'
    }`}>
      <header className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900">
          <KindIcon className={`h-5 w-5 ${config.color}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-teal-400">
              {plan.category.name}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${config.badge} ${config.color}`}>
              {config.label}
            </span>
          </div>
          <h2 className="truncate text-sm font-bold text-white">{plan.title}</h2>
          {plan.description && <p className="mt-0.5 line-clamp-1 text-xs text-neutral-400">{plan.description}</p>}
        </div>
        <button
          type="button"
          onClick={() => onArchive(plan.id, plan.title)}
          aria-label={`Удалить план ${plan.title}`}
          className="min-h-11 min-w-11 rounded p-3 text-neutral-600 transition hover:bg-neutral-800 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {plan.statusReason && <p className={`mb-3 text-xs font-semibold ${config.color}`}>{plan.statusReason}</p>}
      <ProgressRows plan={plan} timeProgress={timeProgress} mileageProgress={mileageProgress} bar={config.bar} />
      <p className="mb-3 flex items-center gap-1.5 text-xs text-neutral-500">
        <FileClock className="h-3.5 w-3.5" />
        {intervalText(plan)}
      </p>

      <section className="border-t border-neutral-900 pt-3">
        <h3 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          <Bell className="h-3 w-3" /> Оповещения
        </h3>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {rules.map((rule) => (
            <span key={rule.id} className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[9px] text-neutral-300">
              {formatRule(rule)}
              <button type="button" onClick={() => onDeleteRule(rule.id)} aria-label="Удалить оповещение" className="min-h-7 min-w-7 text-neutral-500 hover:text-red-400">×</button>
            </span>
          ))}
          {rules.length === 0 && <span className="text-[10px] italic text-neutral-600">Не настроены</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          <QuickRule onClick={() => onAddRule(plan.id, 'days_before', '14')}>+ 14 дн</QuickRule>
          <QuickRule onClick={() => onAddRule(plan.id, 'days_before', '7')}>+ 7 дн</QuickRule>
          {plan.scheduleMode !== 'date_only' && (
            <QuickRule onClick={() => onAddRule(plan.id, 'mileage_before', '1000')}>+ 1000 км</QuickRule>
          )}
          <QuickRule onClick={() => onAddRule(plan.id, 'overdue_repeat', '7')}>Повтор 7 дн</QuickRule>
        </div>
      </section>
    </article>
  );
}

function progress(start: number, end: number, value: number) {
  return Math.min(100, Math.max(0, Math.round(((value - start) / (end - start)) * 100)));
}

function intervalText(plan: MaintenancePlan) {
  if (plan.scheduleMode === 'date_only') return `Каждые ${plan.intervalDays} дн.`;
  if (plan.scheduleMode === 'mileage_only') return `Каждые ${plan.intervalMileage?.toLocaleString()} км`;
  if (plan.scheduleMode === 'whichever_comes_first') {
    return `${plan.intervalMileage?.toLocaleString()} км или ${plan.intervalDays} дн.`;
  }
  return 'Ручной срок';
}

function ProgressRows({
  plan,
  timeProgress,
  mileageProgress,
  bar,
}: {
  plan: MaintenancePlan;
  timeProgress: number | null;
  mileageProgress: number | null;
  bar: string;
}) {
  if (timeProgress === null && mileageProgress === null) return null;
  return (
    <div className="mb-3 space-y-2">
      {timeProgress !== null && (
        <ProgressRow
          icon={<Calendar className="h-3 w-3" />}
          from={plan.lastCompletedAt ? new Date(plan.lastCompletedAt).toLocaleDateString('ru-RU') : '—'}
          to={plan.nextDueAt ? new Date(plan.nextDueAt).toLocaleDateString('ru-RU') : '—'}
          value={timeProgress}
          bar={bar}
          label="Прогресс по времени"
        />
      )}
      {mileageProgress !== null && (
        <ProgressRow
          icon={<Gauge className="h-3 w-3" />}
          from={`${(plan.lastCompletedMileage ?? 0).toLocaleString()} км`}
          to={`${plan.nextDueMileage?.toLocaleString()} км`}
          value={mileageProgress}
          bar={bar}
          label="Прогресс по пробегу"
        />
      )}
    </div>
  );
}

function ProgressRow({ icon, from, to, value, bar, label }: {
  icon: React.ReactNode; from: string; to: string; value: number; bar: string; label: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-neutral-500">
        <span className="flex items-center gap-1">{icon}{from}</span><span>{to}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${value}%` }} role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} />
      </div>
    </div>
  );
}

function QuickRule({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="min-h-9 rounded border border-teal-500/10 bg-teal-500/5 px-2 text-[9px] font-bold text-teal-400 transition hover:border-teal-500/30">{children}</button>;
}
