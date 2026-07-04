'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Gauge,
  Calendar,
  Wrench,
  AlertTriangle,
  Plus,
  FileText,
  Eye,
  CheckCircle2,
  Trash2,
  X,
  FileClock,
  Bell
} from 'lucide-react';
import { odometerSchema, maintenancePlanSchema, serviceRecordSchema } from '@/lib/validation';
import { useToast } from '@/components/ToastProvider';

interface Vehicle {
  id: string;
  displayName: string;
  make: string;
  model: string;
  year: number;
  currentMileage: number;
  mileageUnit: string;
  plateNumberEncryptedOrMasked: string | null;
  vinEncryptedOrMasked: string | null;
  fuelType: string | null;
  transmission: string | null;
  engineDescription: string | null;
  notes: string | null;
}

interface Category {
  id: string;
  name: string;
  iconKey: string | null;
}

interface MaintenancePlan {
  id: string;
  categoryId: string;
  category: Category;
  title: string;
  description: string | null;
  kind: 'scheduled_service' | 'inspection' | 'observation' | 'document';
  priority: 'normal' | 'high' | 'critical';
  scheduleMode: 'date_only' | 'mileage_only' | 'whichever_comes_first' | 'manual';
  intervalDays: number | null;
  intervalMileage: number | null;
  soonDaysThreshold: number;
  soonMileageThreshold: number;
  watchDaysThreshold: number;
  watchMileageThreshold: number;
  manualDueAt: string | null;
  manualDueMileage: number | null;
  manualStatus: string;
  disabledAt: string | null;
  lastCompletedAt: string | null;
  lastCompletedMileage: number | null;
  // Calculated by API
  status?: 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' | 'disabled';
  statusReason?: string;
  nextDueAt?: string | null;
  nextDueMileage?: number | null;
  remainingDays?: number | null;
  remainingMileage?: number | null;
}

interface ServiceRecordPlanItem {
  id: string;
  serviceRecordId: string;
  maintenancePlanId: string | null;
  titleSnapshot: string;
  categorySnapshot: string;
  actionType: string;
}

interface ServiceRecord {
  id: string;
  vehicleId: string;
  performedAt: string;
  mileage: number;
  serviceName: string;
  serviceContact: string | null;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  currency: string;
  notes: string | null;
  state: 'confirmed' | 'voided' | 'draft';
  voidReason: string | null;
  planItems: ServiceRecordPlanItem[];
}

interface ReminderRule {
  id: string;
  vehicleId: string | null;
  maintenancePlanId: string | null;
  observationId: string | null;
  triggerType: 'days_before' | 'mileage_before' | 'due_date' | 'due_mileage' | 'overdue_repeat' | 'exact_datetime';
  triggerValue: string | null;
  sendAtLocalTime: string;
  isEnabled: boolean;
  scheduledAt?: string | null;
}

interface Observation {
  id: string;
  vehicleId: string;
  maintenancePlanId: string | null;
  maintenancePlan?: {
    id: string;
    title: string;
    category: {
      name: string;
    };
  } | null;
  title: string;
  description: string | null;
  priority: 'normal' | 'high' | 'critical';
  state: 'open' | 'watching' | 'service_planned' | 'closed';
  createdAt: string;
  closedAt: string | null;
  photoUrl: string | null;
  serviceRecordId: string | null;
  serviceRecord?: {
    id: string;
    serviceName: string;
    mileage: number;
    performedAt: string;
  } | null;
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: vehicleId } = use(params);
  const { showToast } = useToast();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Modals state
  const [isMileageModalOpen, setIsMileageModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Odometer form state
  const [odoFormData, setOdoFormData] = useState({
    mileage: 0,
    source: 'manual' as 'manual' | 'correction' | 'service_record' | 'import',
    comment: '',
    recordedAt: new Date().toISOString().split('T')[0],
  });
  const [odoErrors, setOdoErrors] = useState<Record<string, string>>({});

  // Plan form state
  const [planFormData, setPlanFormData] = useState({
    categoryId: '',
    title: '',
    description: '',
    kind: 'scheduled_service' as 'scheduled_service' | 'inspection' | 'observation' | 'document',
    priority: 'normal' as 'normal' | 'high' | 'critical',
    scheduleMode: 'whichever_comes_first' as 'date_only' | 'mileage_only' | 'whichever_comes_first' | 'manual',
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
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'plans' | 'records' | 'observations'>(
    tabParam === 'observations' ? 'observations' : tabParam === 'records' ? 'records' : 'plans'
  );
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);

  const [observations, setObservations] = useState<Observation[]>([]);
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [obsFormData, setObsFormData] = useState({
    title: '',
    description: '',
    priority: 'normal' as 'normal' | 'high' | 'critical',
    state: 'open' as 'open' | 'watching' | 'service_planned' | 'closed',
    photoUrl: '',
    maintenancePlanId: '',
  });
  const [obsErrors, setObsErrors] = useState<Record<string, string>>({});
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);

  // Service Record Modal state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordFormData, setRecordFormData] = useState({
    performedAt: new Date().toISOString().split('T')[0],
    mileage: '' as number | '',
    serviceName: '',
    serviceContact: '',
    laborCost: 0,
    partsCost: 0,
    currency: 'RUB',
    notes: '',
    planIds: [] as string[],
    observationIds: [] as string[],
  });
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({});

  // Void Modal state
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [recordToVoid, setRecordToVoid] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidErrors, setVoidErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      setApiError(null);

      // Fetch vehicle
      const vehicleRes = await fetch(`/api/vehicles/${vehicleId}`);
      if (!vehicleRes.ok) {
        if (vehicleRes.status === 404) throw new Error('Автомобиль не найден');
        if (vehicleRes.status === 403) throw new Error('Доступ запрещен');
        throw new Error('Не удалось загрузить данные автомобиля');
      }
      const vehicleData = await vehicleRes.json();
      setVehicle(vehicleData.vehicle);

      // Initialize odometer form starting value
      setOdoFormData((prev) => ({ ...prev, mileage: vehicleData.vehicle.currentMileage }));

      // Fetch plans
      const plansRes = await fetch(`/api/vehicles/${vehicleId}/plans`);
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans);
      }

      // Fetch service records
      const recordsRes = await fetch(`/api/vehicles/${vehicleId}/records`);
      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        setServiceRecords(recordsData.serviceRecords);
      }

      // Fetch reminder rules
      const rulesRes = await fetch(`/api/reminder-rules?vehicleId=${vehicleId}`);
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setReminderRules(rulesData.reminderRules);
      }

      // Fetch observations
      const obsRes = await fetch(`/api/vehicles/${vehicleId}/observations`);
      if (obsRes.ok) {
        const obsData = await obsRes.json();
        setObservations(obsData.observations);
      }

      // Fetch categories
      const catRes = await fetch(`/api/categories?vehicleId=${vehicleId}`);
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories);
        if (catData.categories.length > 0) {
          setPlanFormData((prev) => ({ ...prev, categoryId: catData.categories[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
      setApiError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Handle odometer form updates
  const handleOdoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOdoErrors({});

    if (!vehicle) return;

    // Validate using Zod
    const validationResult = odometerSchema.safeParse(odoFormData);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setOdoErrors(fieldErrors);
      return;
    }

    // Client-side Business logic check for decrease in mileage
    if (odoFormData.mileage < vehicle.currentMileage) {
      if (odoFormData.source !== 'correction' || !odoFormData.comment.trim()) {
        setOdoErrors({
          mileage: 'Уменьшение пробега допускается только как "Корректировка" с обязательным указанием причины в комментарии.',
        });
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/vehicles/${vehicleId}/odometer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(odoFormData),
      });

      const data = await res.json();
      if (res.ok) {
        setIsMileageModalOpen(false);
        setOdoFormData((prev) => ({ ...prev, comment: '' }));
        fetchData();
        showToast('Пробег успешно обновлен', 'success');
      } else {
        setOdoErrors(data.error?.fieldErrors || { general: data.error?.message });
      }
    } catch (err) {
      console.error(err);
      setOdoErrors({ general: 'Сетевая ошибка при обновлении одометра' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle plan form updates
  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanErrors({});

    // Prep values for validation (convert empty strings/numbers)
    const payload: Record<string, unknown> = {
      ...planFormData,
      intervalDays: planFormData.scheduleMode === 'date_only' || planFormData.scheduleMode === 'whichever_comes_first' ? Number(planFormData.intervalDays) : null,
      intervalMileage: planFormData.scheduleMode === 'mileage_only' || planFormData.scheduleMode === 'whichever_comes_first' ? Number(planFormData.intervalMileage) : null,
      manualDueAt: planFormData.scheduleMode === 'manual' && planFormData.manualDueAt ? planFormData.manualDueAt : null,
      manualDueMileage: planFormData.scheduleMode === 'manual' && planFormData.manualDueMileage ? Number(planFormData.manualDueMileage) : null,
    };

    // Zod validation
    const parsed = maintenancePlanSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      // Handle schema level refinement errors
      if (parsed.error.message.includes('интервал')) {
        fieldErrors['general'] = parsed.error.issues[0]?.message;
      }
      setPlanErrors(fieldErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/vehicles/${vehicleId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setIsPlanModalOpen(false);
        setPlanFormData((prev) => ({
          ...prev,
          title: '',
          description: '',
          intervalDays: 365,
          intervalMileage: 10000,
          manualDueAt: '',
          manualDueMileage: '',
        }));
        fetchData();
        showToast('План ТО успешно добавлен', 'success');
      } else {
        setPlanErrors(data.error?.fieldErrors || { general: data.error?.message });
      }
    } catch (err) {
      console.error(err);
      setPlanErrors({ general: 'Сетевая ошибка при создании плана ТО' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlanArchive = async (planId: string, title: string) => {
    if (!confirm(`Вы действительно хотите удалить (архивировать) регламентный план "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Не удалось удалить план');
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка при удалении плана');
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordErrors({});
    setIsSubmitting(true);

    const payload = {
      ...recordFormData,
      mileage: Number(recordFormData.mileage),
      laborCost: Number(recordFormData.laborCost),
      partsCost: Number(recordFormData.partsCost),
    };

    const parsed = serviceRecordSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setRecordErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    // Business check for decrease
    if (Number(recordFormData.mileage) < vehicle!.currentMileage) {
      alert('Внимание: Вы вносите историческую запись. Если это корректировка текущего пробега, сделайте это через форму обновления пробега.');
    }

    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsRecordModalOpen(false);
        setRecordFormData({
          performedAt: new Date().toISOString().split('T')[0],
          mileage: '',
          serviceName: '',
          serviceContact: '',
          laborCost: 0,
          partsCost: 0,
          currency: 'RUB',
          notes: '',
          planIds: [],
          observationIds: [],
        });
        await fetchData();
        showToast('Запись о ТО сохранена', 'success');
      } else {
        const errData = await res.json();
        setRecordErrors({ general: errData.error?.message || 'Не удалось сохранить выполненную работу' });
      }
    } catch (err) {
      console.error(err);
      setRecordErrors({ general: 'Сетевая ошибка' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordToVoid) return;
    setVoidErrors({});
    setIsSubmitting(true);

    if (!voidReason.trim()) {
      setVoidErrors({ voidReason: 'Укажите причину отмены работы' });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/records/${recordToVoid}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason }),
      });

      if (res.ok) {
        setIsVoidModalOpen(false);
        setVoidReason('');
        setRecordToVoid(null);
        await fetchData();
      } else {
        const errData = await res.json();
        setVoidErrors({ general: errData.error?.message || 'Не удалось отменить запись' });
      }
    } catch (err) {
      console.error(err);
      setVoidErrors({ general: 'Сетевая ошибка' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleObsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setObsErrors({});
    setIsSubmitting(true);

    const payload = {
      title: obsFormData.title,
      description: obsFormData.description || null,
      priority: obsFormData.priority,
      state: obsFormData.state,
      photoUrl: obsFormData.photoUrl || null,
      maintenancePlanId: obsFormData.maintenancePlanId || null,
    };

    try {
      const url = selectedObsId 
        ? `/api/observations/${selectedObsId}`
        : `/api/vehicles/${vehicleId}/observations`;
      
      const method = selectedObsId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsObsModalOpen(false);
        setObsFormData({
          title: '',
          description: '',
          priority: 'normal',
          state: 'open',
          photoUrl: '',
          maintenancePlanId: '',
        });
        setSelectedObsId(null);
        await fetchData();
        showToast(selectedObsId ? 'Наблюдение обновлено' : 'Наблюдение зафиксировано', 'success');
      } else {
        const errData = await res.json();
        setObsErrors(errData.error?.fieldErrors || { general: errData.error?.message || 'Не удалось сохранить наблюдение' });
      }
    } catch (err) {
      console.error(err);
      setObsErrors({ general: 'Сетевая ошибка' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleObsClose = async (obsId: string, serviceRecordId?: string) => {
    try {
      const res = await fetch(`/api/observations/${obsId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceRecordId }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Не удалось закрыть наблюдение');
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка при закрытии наблюдения');
    }
  };

  const handleObsDelete = async (obsId: string) => {
    if (!confirm('Вы уверены, что хотите удалить это наблюдение?')) return;
    try {
      const res = await fetch(`/api/observations/${obsId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Не удалось удалить наблюдение');
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка при удалении наблюдения');
    }
  };

  const handleEditObsClick = (obs: Observation) => {
    setSelectedObsId(obs.id);
    setObsFormData({
      title: obs.title,
      description: obs.description || '',
      priority: obs.priority,
      state: obs.state,
      photoUrl: obs.photoUrl || '',
      maintenancePlanId: obs.maintenancePlanId || '',
    });
    setIsObsModalOpen(true);
  };

  const handleAddQuickRule = async (planId: string, triggerType: string, triggerValue: string) => {
    try {
      const res = await fetch('/api/reminder-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenancePlanId: planId,
          triggerType,
          triggerValue,
          sendAtLocalTime: '09:00',
          isEnabled: true,
        }),
      });

      if (res.ok) {
        // Reload rules
        const rulesRes = await fetch(`/api/reminder-rules?vehicleId=${vehicleId}`);
        if (rulesRes.ok) {
          const rulesData = await rulesRes.json();
          setReminderRules(rulesData.reminderRules);
        }
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Не удалось создать напоминание');
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка при создании напоминания');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/reminder-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setReminderRules((prev) => prev.filter((r) => r.id !== ruleId));
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Не удалось удалить напоминание');
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка при удалении напоминания');
    }
  };

  const formatRuleText = (rule: ReminderRule) => {
    switch (rule.triggerType) {
      case 'days_before':
        return `За ${rule.triggerValue} дн.`;
      case 'mileage_before':
        return `За ${Number(rule.triggerValue).toLocaleString()} км`;
      case 'due_date':
        return `В день срока`;
      case 'due_mileage':
        return `При наступлении пробега`;
      case 'overdue_repeat':
        return `Повтор каждые ${rule.triggerValue} дн.`;
      case 'exact_datetime':
        return `Точно ${rule.scheduledAt ? new Date(rule.scheduledAt).toLocaleDateString() : ''}`;
      default:
        return 'Напоминание';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (apiError || !vehicle) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
        <h3 className="text-lg font-bold">Ошибка</h3>
        <p className="mt-2 text-sm">{apiError || 'Автомобиль не найден'}</p>
        <Link
          href="/vehicles"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Назад в гараж
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button and title */}
      <div>
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Вернуться в гараж
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {vehicle.displayName}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsMileageModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-750 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <Gauge className="h-4.5 w-4.5 text-teal-400" />
              Обновить пробег
            </button>
            {activeTab === 'plans' ? (
              <button
                onClick={() => setIsPlanModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-400 px-4 py-2.5 text-sm font-semibold text-black transition-colors"
              >
                <Plus className="h-4.5 w-4.5" />
                Добавить план ТО
              </button>
            ) : (
              <button
                onClick={() => setIsRecordModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-400 px-4 py-2.5 text-sm font-semibold text-black transition-colors"
              >
                <Plus className="h-4.5 w-4.5" />
                Внести запись о ТО
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vehicle specs and odometer summary */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Large Odometer widget */}
        <div className="md:col-span-1 flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Текущий пробег
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-extrabold tracking-tight text-white tabular-nums">
                {vehicle.currentMileage.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-neutral-400 uppercase">
                {vehicle.mileageUnit}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-neutral-900 pt-3">
            <p className="text-xs text-neutral-400">
              Обновляйте пробег регулярно, чтобы получать своевременные оповещения по пробегу.
            </p>
          </div>
        </div>

        {/* Technical Data sheet */}
        <div className="md:col-span-2 rounded-xl border border-neutral-800 bg-[#121214] p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-teal-400 mb-4">
            Технические данные
          </h3>
          <div className="grid gap-x-6 gap-y-4 grid-cols-2 sm:grid-cols-3">
            <div>
              <span className="block text-[10px] uppercase font-semibold text-neutral-500">
                Марка / Модель
              </span>
              <span className="text-sm font-medium text-white">
                {vehicle.make} {vehicle.model}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-neutral-500">
                Год выпуска
              </span>
              <span className="text-sm font-medium text-white">{vehicle.year} г.</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-neutral-500">
                Госномер
              </span>
              <span className="text-sm font-medium text-white">
                {vehicle.plateNumberEncryptedOrMasked || 'Не указан'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-neutral-500">
                VIN номер
              </span>
              <span className="text-sm font-medium text-white truncate block max-w-[150px]" title={vehicle.vinEncryptedOrMasked || ''}>
                {vehicle.vinEncryptedOrMasked || 'Не указан'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-neutral-500">
                Двигатель
              </span>
              <span className="text-sm font-medium text-white">
                {vehicle.engineDescription || 'Не указан'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-neutral-500">
                КПП / Топливо
              </span>
              <span className="text-sm font-medium text-white">
                {vehicle.transmission || '—'} / {vehicle.fuelType || '—'}
              </span>
            </div>
          </div>
          {vehicle.notes && (
            <div className="mt-4 border-t border-neutral-900 pt-3">
              <span className="block text-[10px] uppercase font-semibold text-neutral-500 mb-1">
                Заметки
              </span>
              <p className="text-xs text-neutral-300">{vehicle.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'plans'
              ? 'border-teal-500 text-white'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          Планы обслуживания
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'records'
              ? 'border-teal-500 text-white'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          История обслуживания
        </button>
        <button
          onClick={() => setActiveTab('observations')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'observations'
              ? 'border-teal-500 text-white'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          Наблюдения (Нужно проверить)
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-[#121214]/30 p-10 text-center">
              <Wrench className="h-10 w-10 text-neutral-500 mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300">Нет планов обслуживания</h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-sm">
                Создайте первую регламентную задачу (например, замену масла), чтобы следить за ее выполнением.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((p) => {
              // Icon mapping
              let KindIcon = Wrench;
              if (p.kind === 'document') KindIcon = FileText;
              if (p.kind === 'inspection') KindIcon = Eye;
              if (p.kind === 'observation') KindIcon = CheckCircle2;

              // Status config
              const statusCfg = {
                overdue:  { label: 'Просрочено',      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',   dot: 'bg-red-500' },
                soon:     { label: 'Скоро',          color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-500' },
                watch:    { label: 'Наблюдение',    color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-500' },
                normal:   { label: 'В норме',       color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/20',   dot: 'bg-teal-500' },
                unknown:  { label: 'Нет данных',   color: 'text-neutral-400',bg: 'bg-neutral-800 border-neutral-700',    dot: 'bg-neutral-500' },
                disabled: { label: 'Отключено',   color: 'text-neutral-500',bg: 'bg-neutral-900 border-neutral-800',    dot: 'bg-neutral-600' },
              };
              const cfg = statusCfg[p.status ?? 'unknown'];

              // Progress bar calculation (0–100%)
              // Time progress: from lastCompletedAt to nextDueAt
              let timeProgress: number | null = null;
              if (p.lastCompletedAt && p.nextDueAt && p.intervalDays) {
                const start = new Date(p.lastCompletedAt).getTime();
                const end = new Date(p.nextDueAt).getTime();
                const now = Date.now();
                timeProgress = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
              }

              // Mileage progress: from lastCompletedMileage to nextDueMileage
              let mileProgress: number | null = null;
              if (p.lastCompletedMileage != null && p.nextDueMileage != null && p.intervalMileage) {
                const totalInterval = p.intervalMileage;
                const used = (vehicle?.currentMileage ?? 0) - p.lastCompletedMileage;
                mileProgress = Math.min(100, Math.max(0, Math.round((used / totalInterval) * 100)));
              }

              const progressColor = p.status === 'overdue' ? 'bg-red-500'
                : p.status === 'soon' ? 'bg-orange-500'
                : p.status === 'watch' ? 'bg-yellow-500'
                : 'bg-teal-500';

              return (
                <div
                  key={p.id}
                  className={`rounded-xl border bg-[#121214] p-5 transition-all duration-200 hover:border-neutral-700 ${
                    p.status === 'overdue' ? 'border-red-500/25' :
                    p.status === 'soon' ? 'border-orange-500/20' :
                    'border-neutral-800'
                  }`}
                >
                  {/* Card Header: icon + title + status badge */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800">
                      <KindIcon className={`h-5 w-5 ${cfg.color}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="inline-block rounded bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-teal-400">
                          {p.category.name}
                        </span>
                        {p.status && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${cfg.bg} ${cfg.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white leading-tight truncate">{p.title}</h4>
                      {p.description && (
                        <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handlePlanArchive(p.id, p.title)}
                      aria-label={`Удалить план ${p.title}`}
                      className="shrink-0 rounded p-1 text-neutral-600 hover:bg-neutral-800 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Status reason */}
                  {p.statusReason && (
                    <p className={`text-xs font-semibold mb-3 ${cfg.color}`}>{p.statusReason}</p>
                  )}

                  {/* Progress bars */}
                  {(timeProgress !== null || mileProgress !== null) && (
                    <div className="space-y-2 mb-3">
                      {timeProgress !== null && (
                        <div>
                          <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {p.lastCompletedAt ? new Date(p.lastCompletedAt).toLocaleDateString('ru-RU') : '—'}
                            </span>
                            <span className="flex items-center gap-1">
                              {p.nextDueAt ? new Date(p.nextDueAt).toLocaleDateString('ru-RU') : '—'}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-900 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
                              style={{ width: `${timeProgress}%` }}
                              role="progressbar"
                              aria-valuenow={timeProgress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label="Прогресс по времени"
                            />
                          </div>
                        </div>
                      )}
                      {mileProgress !== null && (
                        <div>
                          <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
                            <span className="flex items-center gap-1">
                              <Gauge className="h-3 w-3" />
                              {(p.lastCompletedMileage ?? 0).toLocaleString('ru-RU')} км
                            </span>
                            <span>{p.nextDueMileage?.toLocaleString('ru-RU')} км</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-900 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
                              style={{ width: `${mileProgress}%` }}
                              role="progressbar"
                              aria-valuenow={mileProgress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label="Прогресс по пробегу"
                            />
                          </div>
                        </div>
                      )}
                      {timeProgress === null && mileProgress === null && (
                        <p className="text-[10px] text-neutral-500 italic">
                          Добавьте дату и пробег последней замены, чтобы видеть шкалу
                        </p>
                      )}
                    </div>
                  )}

                  {/* Interval info */}
                  <div className="text-xs text-neutral-500 flex flex-wrap gap-x-4 gap-y-1 mb-3">
                    {p.scheduleMode === 'date_only' && p.intervalDays && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Каждые {p.intervalDays} дн.
                      </span>
                    )}
                    {p.scheduleMode === 'mileage_only' && p.intervalMileage && (
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3.5 w-3.5" /> Каждые {p.intervalMileage.toLocaleString()} км
                      </span>
                    )}
                    {p.scheduleMode === 'whichever_comes_first' && (
                      <span className="flex items-center gap-1.5">
                        <FileClock className="h-3.5 w-3.5" />
                        {p.intervalMileage?.toLocaleString()} км или {p.intervalDays} дн.
                      </span>
                    )}
                    {p.scheduleMode === 'manual' && (
                      <span>Ручной срок</span>
                    )}
                  </div>

                  {/* Reminder rules */}
                  <div className="border-t border-neutral-900 pt-3">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
                      <Bell className="h-3 w-3" /> Оповещения
                    </span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {reminderRules
                        .filter((r) => r.maintenancePlanId === p.id)
                        .map((rule) => (
                          <div
                            key={rule.id}
                            className="flex items-center gap-1.5 rounded-full bg-neutral-950 px-2 py-0.5 text-[9px] text-neutral-300 border border-neutral-800"
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${rule.isEnabled ? 'bg-teal-400' : 'bg-neutral-600'}`} />
                            <span>{formatRuleText(rule)}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.id)}
                              aria-label="Удалить оповещение"
                              className="text-neutral-500 hover:text-red-400 transition font-bold leading-none"
                            >×</button>
                          </div>
                        ))}
                      {reminderRules.filter((r) => r.maintenancePlanId === p.id).length === 0 && (
                        <span className="text-[10px] text-neutral-600 italic">Напоминания не настроены</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => handleAddQuickRule(p.id, 'days_before', '14')}
                        className="text-[9px] font-bold text-teal-400 border border-teal-500/10 hover:border-teal-500/30 bg-teal-500/5 px-2 py-0.5 rounded transition">+ 14 дн</button>
                      <button type="button" onClick={() => handleAddQuickRule(p.id, 'days_before', '7')}
                        className="text-[9px] font-bold text-teal-400 border border-teal-500/10 hover:border-teal-500/30 bg-teal-500/5 px-2 py-0.5 rounded transition">+ 7 дн</button>
                      {p.scheduleMode !== 'date_only' && (
                        <>
                          <button type="button" onClick={() => handleAddQuickRule(p.id, 'mileage_before', '1000')}
                            className="text-[9px] font-bold text-teal-400 border border-teal-500/10 hover:border-teal-500/30 bg-teal-500/5 px-2 py-0.5 rounded transition">+ 1000 км</button>
                          <button type="button" onClick={() => handleAddQuickRule(p.id, 'mileage_before', '500')}
                            className="text-[9px] font-bold text-teal-400 border border-teal-500/10 hover:border-teal-500/30 bg-teal-500/5 px-2 py-0.5 rounded transition">+ 500 км</button>
                        </>
                      )}
                      <button type="button" onClick={() => handleAddQuickRule(p.id, 'overdue_repeat', '7')}
                        className="text-[9px] font-bold text-amber-400 border border-amber-500/10 hover:border-amber-500/30 bg-amber-500/5 px-2 py-0.5 rounded transition">Повтор 7 дн</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

      {activeTab === 'records' && (
        <div className="space-y-4">
          {serviceRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-[#121214]/30 p-10 text-center">
              <FileClock className="h-10 w-10 text-neutral-500 mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300">История обслуживания пуста</h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-sm">
                Внесите первую запись о выполненном обслуживании, чтобы следить за историей затрат.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {serviceRecords.map((record) => {
                const totalCost = Number(record.totalCost);
                const isVoided = record.state === 'voided';

                return (
                  <div
                    key={record.id}
                    className={`rounded-xl border border-neutral-800 bg-[#121214] p-5 shadow-md flex flex-col gap-4 transition-opacity ${
                      isVoided ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-900 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold text-white ${isVoided ? 'line-through' : ''}`}>
                            {record.serviceName}
                          </span>
                          {isVoided && (
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0">
                              Отменено
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(record.performedAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-teal-400">
                        {totalCost.toLocaleString('ru-RU')} {record.currency === 'RUB' ? '₽' : record.currency}
                      </span>
                    </div>

                    <div className="grid gap-4 grid-cols-2 text-xs text-neutral-400">
                      <div>
                        <span className="block text-[10px] uppercase text-neutral-500 font-semibold mb-0.5">Пробег</span>
                        <span className="font-mono text-white">{record.mileage.toLocaleString()} км</span>
                      </div>
                      {record.serviceContact && (
                        <div>
                          <span className="block text-[10px] uppercase text-neutral-500 font-semibold mb-0.5">Место / СТО</span>
                          <span className="text-white">{record.serviceContact}</span>
                        </div>
                      )}
                      <div>
                        <span className="block text-[10px] uppercase text-neutral-500 font-semibold mb-0.5">Стоимость</span>
                        <span>Раб.: {Number(record.laborCost).toLocaleString()} ₽ / Запч.: {Number(record.partsCost).toLocaleString()} ₽</span>
                      </div>
                      {record.planItems?.length > 0 && (
                        <div>
                          <span className="block text-[10px] uppercase text-neutral-500 font-semibold mb-0.5">Выполненные задачи</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {record.planItems.map((item: ServiceRecordPlanItem) => (
                              <span key={item.id} className="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded text-[9px]">
                                {item.titleSnapshot}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {record.notes && (
                      <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-900 text-xs text-neutral-400">
                        <strong>Заметки:</strong> {record.notes}
                      </div>
                    )}

                    {isVoided && record.voidReason && (
                      <div className="bg-red-500/5 p-3 rounded-lg border border-red-500/10 text-xs text-red-400">
                        <strong>Причина отмены:</strong> {record.voidReason}
                      </div>
                    )}

                    {!isVoided && (
                      <div className="flex justify-end pt-2 border-t border-neutral-900/50">
                        <button
                          onClick={() => {
                            setRecordToVoid(record.id);
                            setIsVoidModalOpen(true);
                          }}
                          className="text-xs font-bold text-red-400 hover:text-red-300 border border-red-500/15 bg-red-500/5 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition"
                        >
                          Отменить запись
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'observations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Список наблюдений (&quot;Нужно проверить&quot;)</h2>
            <button
              onClick={() => {
                setSelectedObsId(null);
                setObsFormData({
                  title: '',
                  description: '',
                  priority: 'normal',
                  state: 'open',
                  photoUrl: '',
                  maintenancePlanId: '',
                });
                setIsObsModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-black hover:bg-teal-400 transition"
            >
              <Plus className="h-4 w-4" />
              Добавить симптом
            </button>
          </div>

          {observations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-[#121214]/30 p-10 text-center">
              <AlertTriangle className="h-10 w-10 text-neutral-500 mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300">Нет зафиксированных симптомов</h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-sm">
                Запишите замеченные неисправности или симптомы (например, шум в подвеске), чтобы не забыть проверить их.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {observations.map((obs) => {
                let priorityColor = 'bg-neutral-800/40 text-neutral-400 border-neutral-800';
                if (obs.priority === 'high') {
                  priorityColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                } else if (obs.priority === 'critical') {
                  priorityColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                }

                let stateLabel = 'Открыто';
                let stateColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                if (obs.state === 'watching') {
                  stateLabel = 'Под наблюдением';
                  stateColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                } else if (obs.state === 'service_planned') {
                  stateLabel = 'Запланирован ремонт';
                  stateColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                } else if (obs.state === 'closed') {
                  stateLabel = 'Решено';
                  stateColor = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                }

                return (
                  <div
                    key={obs.id}
                    className={`flex flex-col justify-between rounded-xl border border-neutral-800 bg-[#121214] p-5 hover:border-neutral-700 transition-all duration-200 ${
                      obs.state === 'closed' ? 'opacity-60' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase border ${priorityColor}`}>
                          Приоритет: {obs.priority === 'critical' ? 'Критичный' : obs.priority === 'high' ? 'Высокий' : 'Обычный'}
                        </span>
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase border ${stateColor}`}>
                          {stateLabel}
                        </span>
                      </div>
                      <h4 className={`text-sm font-bold text-white ${obs.state === 'closed' ? 'line-through text-neutral-400' : ''}`}>{obs.title}</h4>
                      {obs.description && (
                        <p className="text-xs text-neutral-400 mt-1">{obs.description}</p>
                      )}

                      {obs.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={obs.photoUrl} alt={obs.title} className="mt-3 max-h-40 w-full object-cover rounded-lg border border-neutral-800" />
                      )}

                      <div className="pt-2 text-[10px] text-neutral-500 flex flex-col gap-1 border-t border-neutral-900 mt-3">
                        <span>Создано: {new Date(obs.createdAt).toLocaleDateString()}</span>
                        {obs.closedAt && (
                          <span>Решено: {new Date(obs.closedAt).toLocaleDateString()}</span>
                        )}
                        {obs.maintenancePlan && (
                          <span className="text-teal-400">Связано с планом: {obs.maintenancePlan.title}</span>
                        )}
                        {obs.serviceRecord && (
                          <span className="text-teal-500">
                            Решено в ТО: {obs.serviceRecord.serviceName} ({obs.serviceRecord.mileage.toLocaleString()} км, {new Date(obs.serviceRecord.performedAt).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-neutral-900/60">
                      {obs.state !== 'closed' && (
                        <>
                          <button
                            onClick={() => handleObsClose(obs.id)}
                            className="text-[10px] font-bold text-teal-400 border border-teal-500/15 bg-teal-500/5 px-2.5 py-1 rounded hover:bg-teal-500/10 transition cursor-pointer"
                          >
                            Отметить решенным
                          </button>
                          <button
                            onClick={() => handleEditObsClick(obs)}
                            className="text-[10px] font-bold text-neutral-400 border border-neutral-800 bg-neutral-900/40 px-2.5 py-1 rounded hover:bg-neutral-800 transition cursor-pointer"
                          >
                            Изменить
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleObsDelete(obs.id)}
                        className="text-[10px] font-bold text-red-400 border border-red-500/15 bg-red-500/5 px-2.5 py-1 rounded hover:bg-red-500/10 transition cursor-pointer"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 1. Update Odometer mileage Modal (Bottom Sheet / Center Dialog) */}
      {isMileageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          <div className="relative flex w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-neutral-800 bg-[#121214] text-neutral-100 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-900 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Обновить пробег</h2>
              <button
                onClick={() => setIsMileageModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleOdoSubmit} className="p-6 space-y-4">
              {odoErrors.general && (
                <div className="rounded bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                  {odoErrors.general}
                </div>
              )}

              {/* Mileage Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Новый пробег ({vehicle.mileageUnit}) <span className="text-teal-400">*</span>
                </label>
                <input
                  type="number"
                  name="mileage"
                  value={odoFormData.mileage}
                  onChange={(e) =>
                    setOdoFormData((prev) => ({ ...prev, mileage: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                {odoErrors.mileage && (
                  <p className="mt-1.5 text-xs text-red-400 leading-tight">{odoErrors.mileage}</p>
                )}
              </div>

              {/* Grid: Source & Date */}
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Тип записи
                  </label>
                  <select
                    name="source"
                    value={odoFormData.source}
                    onChange={(e) =>
                      setOdoFormData((prev) => ({
                        ...prev,
                        source: e.target.value as 'manual' | 'correction' | 'service_record' | 'import',
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Дата записи
                  </label>
                  <input
                    type="date"
                    name="recordedAt"
                    value={odoFormData.recordedAt}
                    onChange={(e) =>
                      setOdoFormData((prev) => ({ ...prev, recordedAt: e.target.value }))
                    }
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic warning if mileage is less than current */}
              {odoFormData.mileage < vehicle.currentMileage && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Внимание: Уменьшение пробега!</span>
                    Для снижения пробега выберите тип <strong>&quot;Корректировка&quot;</strong> и обязательно заполните текстовый комментарий с причиной.
                  </div>
                </div>
              )}

              {/* Comment / Reason */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Комментарий / Причина {odoFormData.mileage < vehicle.currentMileage && <span className="text-amber-400">*</span>}
                </label>
                <input
                  type="text"
                  name="comment"
                  value={odoFormData.comment}
                  onChange={(e) => setOdoFormData((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder={odoFormData.mileage < vehicle.currentMileage ? "Укажите причину снижения пробега" : "По желанию (напр. Замена приборной панели)"}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-neutral-900 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsMileageModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-850 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Сохранение...' : 'Обновить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Maintenance Plan Modal (Bottom Sheet / Center Dialog) */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          <div className="relative flex max-h-[92vh] sm:max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-neutral-800 bg-[#121214] text-neutral-100 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-900 px-6 py-4.5">
              <h2 className="text-lg font-bold text-white">Новый план обслуживания</h2>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {planErrors.general && (
                <div className="rounded bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-400 font-medium">
                  {planErrors.general}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Название ТО / Работы <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={planFormData.title}
                  onChange={(e) => setPlanFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Замена масла в ДВС, Замена передних колодок..."
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                {planErrors.title && <p className="mt-1 text-xs text-red-400">{planErrors.title}</p>}
              </div>

              {/* Category & Kind */}
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Категория <span className="text-teal-400">*</span>
                  </label>
                  <select
                    name="categoryId"
                    value={planFormData.categoryId}
                    onChange={(e) => setPlanFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Тип работы
                  </label>
                  <select
                    name="kind"
                    value={planFormData.kind}
                    onChange={(e) => setPlanFormData((prev) => ({ ...prev, kind: e.target.value as 'scheduled_service' | 'inspection' | 'observation' | 'document' }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="scheduled_service">Регулярное ТО</option>
                    <option value="inspection">Инспекция / Осмотр</option>
                    <option value="observation">Наблюдение</option>
                    <option value="document">Документы</option>
                  </select>
                </div>
              </div>

              {/* Priority & Schedule Mode */}
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Приоритет
                  </label>
                  <select
                    name="priority"
                    value={planFormData.priority}
                    onChange={(e) => setPlanFormData((prev) => ({ ...prev, priority: e.target.value as 'normal' | 'high' | 'critical' }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="normal">Обычный (normal)</option>
                    <option value="high">Высокий (high)</option>
                    <option value="critical">Критический (critical)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-teal-400 mb-1.5">
                    Режим расчета срока <span className="text-teal-400">*</span>
                  </label>
                  <select
                    name="scheduleMode"
                    value={planFormData.scheduleMode}
                    onChange={(e) => setPlanFormData((prev) => ({ ...prev, scheduleMode: e.target.value as 'date_only' | 'mileage_only' | 'whichever_comes_first' | 'manual' }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="whichever_comes_first">Что наступит раньше</option>
                    <option value="date_only">Только по дате</option>
                    <option value="mileage_only">Только по пробегу</option>
                    <option value="manual">Ручной ввод срока</option>
                  </select>
                </div>
              </div>

              {/* Dynamic form inputs based on Schedule Mode */}
              <div className="rounded-lg bg-neutral-900/40 border border-neutral-850 p-4 space-y-4">
                {/* Interval Days (if date_only or whichever) */}
                {(planFormData.scheduleMode === 'date_only' || planFormData.scheduleMode === 'whichever_comes_first') && (
                  <div className="grid gap-4 grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                        Интервал (дней) <span className="text-teal-400">*</span>
                      </label>
                      <input
                        type="number"
                        name="intervalDays"
                        value={planFormData.intervalDays}
                        onChange={(e) => setPlanFormData((prev) => ({ ...prev, intervalDays: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-sm text-white"
                      />
                      {planErrors.intervalDays && <p className="mt-1 text-xs text-red-400">{planErrors.intervalDays}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Порог &quot;Скоро&quot; (дней)
                      </label>
                      <input
                        type="number"
                        name="soonDaysThreshold"
                        value={planFormData.soonDaysThreshold}
                        onChange={(e) => setPlanFormData((prev) => ({ ...prev, soonDaysThreshold: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-sm text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Interval Mileage (if mileage_only or whichever) */}
                {(planFormData.scheduleMode === 'mileage_only' || planFormData.scheduleMode === 'whichever_comes_first') && (
                  <div className="grid gap-4 grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                        Интервал пробега (км) <span className="text-teal-400">*</span>
                      </label>
                      <input
                        type="number"
                        name="intervalMileage"
                        value={planFormData.intervalMileage}
                        onChange={(e) => setPlanFormData((prev) => ({ ...prev, intervalMileage: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-sm text-white"
                      />
                      {planErrors.intervalMileage && <p className="mt-1 text-xs text-red-400">{planErrors.intervalMileage}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Порог &quot;Скоро&quot; (км)
                      </label>
                      <input
                        type="number"
                        name="soonMileageThreshold"
                        value={planFormData.soonMileageThreshold}
                        onChange={(e) => setPlanFormData((prev) => ({ ...prev, soonMileageThreshold: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-sm text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Manual Dates/Mileage (if manual) */}
                {planFormData.scheduleMode === 'manual' && (
                  <div className="grid gap-4 grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                        Срок по дате
                      </label>
                      <input
                        type="date"
                        name="manualDueAt"
                        value={planFormData.manualDueAt}
                        onChange={(e) => setPlanFormData((prev) => ({ ...prev, manualDueAt: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                        Срок по пробегу (км)
                      </label>
                      <input
                        type="number"
                        name="manualDueMileage"
                        value={planFormData.manualDueMileage}
                        onChange={(e) => setPlanFormData((prev) => ({ ...prev, manualDueMileage: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-sm text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Описание плана (заметки)
                </label>
                <textarea
                  name="description"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Дополнительные примечания к работе..."
                  rows={2}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-neutral-900 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Создание...' : 'Создать план'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Record Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsRecordModalOpen(false)}></div>
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] rounded-t-3xl border-t border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-5">
              <h3 className="text-lg font-bold tracking-tight">Внести запись о ТО</h3>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-5">
              {recordErrors.general && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
                  {recordErrors.general}
                </div>
              )}

              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Дата выполнения <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="performedAt"
                    value={recordFormData.performedAt}
                    onChange={(e) => setRecordFormData((prev) => ({ ...prev, performedAt: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white"
                    required
                  />
                  {recordErrors.performedAt && <p className="mt-1 text-xs text-red-400">{recordErrors.performedAt}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Пробег (км) <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="mileage"
                    value={recordFormData.mileage}
                    onChange={(e) => setRecordFormData((prev) => ({ ...prev, mileage: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white"
                    required
                  />
                  {recordErrors.mileage && <p className="mt-1 text-xs text-red-400">{recordErrors.mileage}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Название выполненной работы <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  name="serviceName"
                  value={recordFormData.serviceName}
                  onChange={(e) => setRecordFormData((prev) => ({ ...prev, serviceName: e.target.value }))}
                  placeholder="Например: Замена моторного масла и фильтра"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white"
                  required
                />
                  {recordErrors.serviceName && <p className="mt-1 text-xs text-red-400">{recordErrors.serviceName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Место обслуживания / СТО
                </label>
                <input
                  type="text"
                  name="serviceContact"
                  value={recordFormData.serviceContact}
                  onChange={(e) => setRecordFormData((prev) => ({ ...prev, serviceContact: e.target.value }))}
                  placeholder="Например: СТО Рено-Сервис"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white"
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Стоимость работ (₽)
                  </label>
                  <input
                    type="number"
                    name="laborCost"
                    value={recordFormData.laborCost}
                    onChange={(e) => setRecordFormData((prev) => ({ ...prev, laborCost: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white"
                  />
                  {recordErrors.laborCost && <p className="mt-1 text-xs text-red-400">{recordErrors.laborCost}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Стоимость запчастей (₽)
                  </label>
                  <input
                    type="number"
                    name="partsCost"
                    value={recordFormData.partsCost}
                    onChange={(e) => setRecordFormData((prev) => ({ ...prev, partsCost: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white"
                  />
                  {recordErrors.partsCost && <p className="mt-1 text-xs text-red-400">{recordErrors.partsCost}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Связать с регламентными планами (выберите выполненные задачи)
                </label>
                {plans.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">Нет созданных планов ТО для привязки</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-neutral-800 rounded-lg p-3 bg-neutral-950">
                    {plans.map((p) => (
                      <label key={p.id} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={recordFormData.planIds.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRecordFormData((prev) => ({ ...prev, planIds: [...prev.planIds, p.id] }));
                            } else {
                              setRecordFormData((prev) => ({ ...prev, planIds: prev.planIds.filter((id) => id !== p.id) }));
                            }
                          }}
                          className="rounded border-neutral-700 bg-neutral-900 text-teal-500 focus:ring-teal-500 h-4 w-4"
                        />
                        <div>
                          <span className="font-semibold text-white block leading-tight">{p.title}</span>
                          <span className="text-[10px] text-teal-400">{p.category.name}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Устранить открытые наблюдения (отметьте решенные симптомы)
                </label>
                {observations.filter(o => o.state !== 'closed').length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">Нет открытых наблюдений для устранения</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-neutral-800 rounded-lg p-3 bg-neutral-950">
                    {observations
                      .filter(o => o.state !== 'closed')
                      .map((o) => (
                        <label key={o.id} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={recordFormData.observationIds.includes(o.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRecordFormData((prev) => ({ ...prev, observationIds: [...prev.observationIds, o.id] }));
                              } else {
                                setRecordFormData((prev) => ({ ...prev, observationIds: prev.observationIds.filter((id) => id !== o.id) }));
                              }
                            }}
                            className="rounded border-neutral-700 bg-neutral-900 text-teal-500 focus:ring-teal-500 h-4 w-4"
                          />
                          <div>
                            <span className="font-semibold text-white block leading-tight">{o.title}</span>
                            <span className="text-[10px] text-amber-400">
                              Приоритет: {o.priority === 'critical' ? 'Критичный' : o.priority === 'high' ? 'Высокий' : 'Обычный'}
                            </span>
                          </div>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Заметки / Описание работ
                </label>
                <textarea
                  name="notes"
                  value={recordFormData.notes}
                  onChange={(e) => setRecordFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Перечислите замененные запчасти, артикулы или другие детали..."
                  rows={3}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-neutral-850 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Сохранение...' : 'Сохранить запись'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsVoidModalOpen(false)}></div>
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl">
            <h3 className="text-lg font-bold tracking-tight text-white mb-2">Отменить запись обслуживания?</h3>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Выполненные работы будут помечены как «Отменено». Связанные регламентные сроки планов ТО будут автоматически пересчитаны по остальным записям.
            </p>

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              {voidErrors.general && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
                  {voidErrors.general}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Причина отмены <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  name="voidReason"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Укажите причину (например: Ошибочный ввод)"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white"
                  required
                />
                {voidErrors.voidReason && <p className="mt-1 text-xs text-red-400">{voidErrors.voidReason}</p>}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Отмена...' : 'Да, отменить работу'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 4. Add/Edit Observation Modal */}
      {isObsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          <div className="absolute inset-0" onClick={() => setIsObsModalOpen(false)}></div>
          <div className="relative flex w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-neutral-800 bg-[#121214] text-neutral-100 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-900 px-6 py-4">
              <h2 className="text-lg font-bold text-white">
                {selectedObsId ? 'Редактировать симптом' : 'Добавить симптом в "Нужно проверить"'}
              </h2>
              <button
                onClick={() => setIsObsModalOpen(false)}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleObsSubmit} className="space-y-4 p-6 overflow-y-auto max-h-[80vh]">
              {obsErrors.general && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
                  {obsErrors.general}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Название неисправности / Симптом <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  value={obsFormData.title}
                  onChange={(e) => setObsFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Например: Скрип спереди справа при торможении"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                  required
                />
                {obsErrors.title && <p className="mt-1 text-xs text-red-400">{obsErrors.title}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Описание симптомов и детали
                </label>
                <textarea
                  value={obsFormData.description}
                  onChange={(e) => setObsFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Опишите подробнее: когда появляется звук, на какой скорости..."
                  rows={3}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
                {obsErrors.description && <p className="mt-1 text-xs text-red-400">{obsErrors.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Приоритет
                  </label>
                  <select
                    value={obsFormData.priority}
                    onChange={(e) => setObsFormData((prev) => ({ ...prev, priority: e.target.value as 'normal' | 'high' | 'critical' }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="normal">Обычный</option>
                    <option value="high">Высокий</option>
                    <option value="critical">Критичный</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Статус
                  </label>
                  <select
                    value={obsFormData.state}
                    onChange={(e) => setObsFormData((prev) => ({ ...prev, state: e.target.value as 'open' | 'watching' | 'service_planned' | 'closed' }))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="open">Открыто</option>
                    <option value="watching">Наблюдаю</option>
                    <option value="service_planned">Запланирован визит</option>
                    <option value="closed">Решено</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Связать с регламентными планами (необязательно)
                </label>
                <select
                  value={obsFormData.maintenancePlanId}
                  onChange={(e) => setObsFormData((prev) => ({ ...prev, maintenancePlanId: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                >
                  <option value="">Не связывать</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.category.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Ссылка на фото (необязательно)
                </label>
                <input
                  type="text"
                  value={obsFormData.photoUrl}
                  onChange={(e) => setObsFormData((prev) => ({ ...prev, photoUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setIsObsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-850 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-black hover:bg-teal-400 transition"
                >
                  {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
