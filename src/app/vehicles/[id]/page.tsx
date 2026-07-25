'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import type { Observation, ReminderRule } from '@/features/vehicle-workspace/types';
import { VehicleOverviewHeader } from '@/features/vehicle-workspace/components/VehicleOverviewHeader';
import { ServiceRecordsPanel } from '@/features/vehicle-workspace/components/ServiceRecordsPanel';
import { ObservationsPanel } from '@/features/vehicle-workspace/components/ObservationsPanel';
import { MaintenancePlansPanel } from '@/features/vehicle-workspace/components/MaintenancePlansPanel';
import {
  VehicleWorkspaceTabs,
  type VehicleWorkspaceTab,
} from '@/features/vehicle-workspace/components/VehicleWorkspaceTabs';
import { OdometerDialog } from '@/features/vehicle-workspace/forms/OdometerDialog';
import { MaintenancePlanDialog } from '@/features/vehicle-workspace/forms/MaintenancePlanDialog';
import { ServiceRecordDialog } from '@/features/vehicle-workspace/forms/ServiceRecordDialog';
import { VoidRecordDialog } from '@/features/vehicle-workspace/forms/VoidRecordDialog';
import { ObservationDialog } from '@/features/vehicle-workspace/forms/ObservationDialog';
import { useVehicleWorkspace } from '@/features/vehicle-workspace/hooks/useVehicleWorkspace';
import {
  archiveMaintenancePlan,
  closeObservation,
  createReminderRule,
  deleteObservation,
  deleteReminderRule,
} from '@/features/vehicle-workspace/api/actions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastProvider';

function formatRuleText(rule: ReminderRule) {
  switch (rule.triggerType) {
    case 'days_before':
      return `За ${rule.triggerValue} дн.`;
    case 'mileage_before':
      return `За ${Number(rule.triggerValue).toLocaleString()} км`;
    case 'due_date':
      return 'В день срока';
    case 'due_mileage':
      return 'При наступлении пробега';
    case 'overdue_repeat':
      return `Повтор каждые ${rule.triggerValue} дн.`;
    case 'exact_datetime':
      return `Точно ${rule.scheduledAt ? new Date(rule.scheduledAt).toLocaleDateString() : ''}`;
    default:
      return 'Напоминание';
  }
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: vehicleId } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<VehicleWorkspaceTab>(
    tabParam === 'observations'
      ? 'observations'
      : tabParam === 'records'
        ? 'records'
        : 'plans'
  );
  const [openDialog, setOpenDialog] = useState<
    'odometer' | 'plan' | 'record' | 'observation' | null
  >(null);
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null);
  const [recordToVoid, setRecordToVoid] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    run: () => Promise<void>;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const workspace = useVehicleWorkspace(vehicleId);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextTab: VehicleWorkspaceTab =
        tabParam === 'observations' ? 'observations' : tabParam === 'records' ? 'records' : 'plans';
      setActiveTab(nextTab);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tabParam]);

  const changeTab = (tab: VehicleWorkspaceTab) => {
    setActiveTab(tab);
    const query = new URLSearchParams(searchParams.toString());
    query.set('tab', tab);
    router.push(`${pathname}?${query.toString()}`, { scroll: false });
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    try {
      setIsConfirming(true);
      await confirmAction.run();
      setConfirmAction(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось выполнить действие', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  const handlePlanArchive = async (planId: string, title: string) => {
    setConfirmAction({
      title: 'Архивировать план?',
      description: `План «${title}» исчезнет из активного списка. История выполненных работ сохранится.`,
      confirmLabel: 'Архивировать',
      run: async () => {
        await archiveMaintenancePlan(planId);
        await workspace.refresh();
        showToast('План перемещён в архив', 'info');
      },
    });
  };

  const handleObservationClose = async (observationId: string, serviceRecordId?: string) => {
    try {
      await closeObservation(observationId, serviceRecordId);
      await workspace.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось закрыть наблюдение', 'error');
    }
  };

  const handleObservationDelete = async (observationId: string) => {
    setConfirmAction({
      title: 'Удалить наблюдение?',
      description: 'Наблюдение будет удалено без возможности восстановления.',
      confirmLabel: 'Удалить',
      run: async () => {
        await deleteObservation(observationId);
        await workspace.refresh();
        showToast('Наблюдение удалено', 'info');
      },
    });
  };

  const handleAddRule = async (
    planId: string,
    triggerType: string,
    triggerValue: string
  ) => {
    try {
      await createReminderRule(planId, triggerType, triggerValue);
      await workspace.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось создать напоминание', 'error');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setConfirmAction({
      title: 'Удалить напоминание?',
      description: 'Новые уведомления по этому правилу больше не будут создаваться.',
      confirmLabel: 'Удалить',
      run: async () => {
        await deleteReminderRule(ruleId);
        workspace.setReminderRules((current) => current.filter((rule) => rule.id !== ruleId));
        showToast('Правило напоминания удалено', 'info');
      },
    });
  };

  if (workspace.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center" aria-label="Загрузка автомобиля">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (workspace.error || !workspace.vehicle) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12" aria-hidden="true" />
        <h3 className="text-lg font-bold">Ошибка</h3>
        <p className="mt-2 text-sm">{workspace.error || 'Автомобиль не найден'}</p>
        <Link href="/vehicles" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Назад в гараж
        </Link>
      </div>
    );
  }

  const vehicle = workspace.vehicle;

  return (
    <div className="space-y-8">
      <VehicleOverviewHeader
        vehicle={vehicle}
        activeTab={activeTab}
        onOpenMileage={() => setOpenDialog('odometer')}
        onOpenPlan={() => setOpenDialog('plan')}
        onOpenRecord={() => setOpenDialog('record')}
      />

      <VehicleWorkspaceTabs activeTab={activeTab} onChange={changeTab} />

      {activeTab === 'plans' && (
        <MaintenancePlansPanel
          plans={workspace.plans}
          reminderRules={workspace.reminderRules}
          currentMileage={vehicle.currentMileage}
          nowMs={workspace.progressNowMs}
          onArchive={handlePlanArchive}
          onAddRule={handleAddRule}
          onDeleteRule={handleDeleteRule}
          formatRule={formatRuleText}
        />
      )}

      {activeTab === 'records' && (
        <ServiceRecordsPanel records={workspace.serviceRecords} onVoid={setRecordToVoid} />
      )}

      {activeTab === 'observations' && (
        <ObservationsPanel
          observations={workspace.observations}
          onAdd={() => {
            setSelectedObservation(null);
            setOpenDialog('observation');
          }}
          onClose={handleObservationClose}
          onEdit={(observation) => {
            setSelectedObservation(observation);
            setOpenDialog('observation');
          }}
          onDelete={handleObservationDelete}
        />
      )}

      {openDialog === 'odometer' && (
        <OdometerDialog
          vehicle={vehicle}
          onClose={() => setOpenDialog(null)}
          onSaved={workspace.refresh}
        />
      )}
      {openDialog === 'plan' && (
        <MaintenancePlanDialog
          vehicleId={vehicleId}
          categories={workspace.categories}
          onClose={() => setOpenDialog(null)}
          onSaved={workspace.refresh}
        />
      )}
      {openDialog === 'record' && (
        <ServiceRecordDialog
          vehicle={vehicle}
          plans={workspace.plans}
          observations={workspace.observations}
          onClose={() => setOpenDialog(null)}
          onSaved={workspace.refresh}
        />
      )}
      {openDialog === 'observation' && (
        <ObservationDialog
          vehicleId={vehicleId}
          plans={workspace.plans}
          observation={selectedObservation}
          onClose={() => {
            setOpenDialog(null);
            setSelectedObservation(null);
          }}
          onSaved={workspace.refresh}
        />
      )}
      {recordToVoid && (
        <VoidRecordDialog
          recordId={recordToVoid}
          onClose={() => setRecordToVoid(null)}
          onSaved={workspace.refresh}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          destructive
          isBusy={isConfirming}
          onClose={() => {
            if (!isConfirming) setConfirmAction(null);
          }}
          onConfirm={() => void runConfirmedAction()}
        />
      )}
    </div>
  );
}
