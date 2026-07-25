export interface PlanForStatusCalculation {
  id: string;
  kind: string; // "scheduled_service" | "inspection" | "observation" | "document"
  priority: string; // "normal" | "high" | "critical"
  scheduleMode: string; // "date_only" | "mileage_only" | "whichever_comes_first" | "manual"
  intervalDays: number | null;
  intervalMileage: number | null;
  lastCompletedAt: Date | null;
  lastCompletedMileage: number | null;
  manualDueAt: Date | null;
  manualDueMileage: number | null;
  soonDaysThreshold: number;
  soonMileageThreshold: number;
  watchDaysThreshold: number;
  watchMileageThreshold: number;
  manualStatus: string;
  disabledAt: Date | null;
  archivedAt: Date | null;
  observations?: {
    id: string;
    priority: string;
    state: string;
  }[];
}

export interface VehicleForStatusCalculation {
  currentMileage: number;
}

export interface PlanStatusResult {
  status: 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' | 'disabled';
  remainingDays: number | null;
  remainingMileage: number | null;
  nextDueAt: Date | null;
  nextDueMileage: number | null;
  statusReason: string;
}

function pluralizeDays(n: number): string {
  const absN = Math.abs(n);
  const mod10 = absN % 10;
  const mod100 = absN % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${absN} день`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${absN} дня`;
  }
  return `${absN} дней`;
}

export function calculatePlanStatus(
  plan: PlanForStatusCalculation,
  vehicle: VehicleForStatusCalculation,
  now: Date = new Date()
): PlanStatusResult {
  // 1. If disabled
  if (plan.disabledAt) {
    return {
      status: 'disabled',
      remainingDays: null,
      remainingMileage: null,
      nextDueAt: null,
      nextDueMileage: null,
      statusReason: 'Отключено',
    };
  }

  // 2. Calculate nextDueAt and nextDueMileage
  let nextDueAt: Date | null = null;
  let nextDueMileage: number | null = null;

  if (plan.scheduleMode === 'manual') {
    nextDueAt = plan.manualDueAt ? new Date(plan.manualDueAt) : null;
    nextDueMileage = plan.manualDueMileage;
  } else {
    // For automatic modes
    if (plan.scheduleMode === 'date_only' || plan.scheduleMode === 'whichever_comes_first') {
      if (plan.lastCompletedAt && plan.intervalDays !== null) {
        const lastDate = new Date(plan.lastCompletedAt);
        nextDueAt = new Date(lastDate.getTime() + plan.intervalDays * 24 * 60 * 60 * 1000);
      }
    }
    if (plan.scheduleMode === 'mileage_only' || plan.scheduleMode === 'whichever_comes_first') {
      if (plan.lastCompletedMileage !== null && plan.intervalMileage !== null) {
        nextDueMileage = plan.lastCompletedMileage + plan.intervalMileage;
      }
    }
  }

  // 3. Calculate remaining days and mileage
  let remainingDays: number | null = null;
  if (nextDueAt) {
    const diffTime = nextDueAt.getTime() - now.getTime();
    remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  let remainingMileage: number | null = null;
  if (nextDueMileage !== null) {
    remainingMileage = nextDueMileage - vehicle.currentMileage;
  }

  // Helper to determine status for date component
  const getDateStatus = (): 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' => {
    if (plan.scheduleMode === 'mileage_only') return 'normal';
    if (!nextDueAt) return 'unknown';
    if (remainingDays! < 0) return 'overdue';
    if (remainingDays! <= plan.soonDaysThreshold) return 'soon';
    if (remainingDays! <= plan.watchDaysThreshold) return 'watch';
    return 'normal';
  };

  // Helper to determine status for mileage component
  const getMileageStatus = (): 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' => {
    if (plan.scheduleMode === 'date_only') return 'normal';
    if (nextDueMileage === null) return 'unknown';
    if (remainingMileage! < 0) return 'overdue';
    if (remainingMileage! <= plan.soonMileageThreshold) return 'soon';
    if (remainingMileage! <= plan.watchMileageThreshold) return 'watch';
    return 'normal';
  };

  const statusSeverity = {
    overdue: 5,
    soon: 4,
    watch: 3,
    unknown: 2,
    normal: 1,
  };

  const dateStatus = getDateStatus();
  const mileageStatus = getMileageStatus();

  let finalStatus: 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' = 'normal';
  const dateRank = statusSeverity[dateStatus];
  const mileageRank = statusSeverity[mileageStatus];

  if (plan.scheduleMode === 'date_only') {
    finalStatus = dateStatus;
  } else if (plan.scheduleMode === 'mileage_only') {
    finalStatus = mileageStatus;
  } else if (plan.scheduleMode === 'whichever_comes_first') {
    // Pick the worse status
    const maxRank = Math.max(dateRank, mileageRank);
    finalStatus = Object.keys(statusSeverity).find(
      (key) => statusSeverity[key as keyof typeof statusSeverity] === maxRank
    ) as 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown';
  } else if (plan.scheduleMode === 'manual') {
    // If manual and both are null
    if (!nextDueAt && nextDueMileage === null) {
      finalStatus = 'unknown';
    } else {
      // Pick the worse of whatever is provided
      const dStat = nextDueAt ? dateStatus : 'normal';
      const mStat = nextDueMileage !== null ? mileageStatus : 'normal';
      const maxRank = Math.max(statusSeverity[dStat], statusSeverity[mStat]);
      finalStatus = Object.keys(statusSeverity).find(
        (key) => statusSeverity[key as keyof typeof statusSeverity] === maxRank
      ) as 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown';
    }
  }

  // 4. Manual overrides and Observations
  const hasActiveHighPriorityObservation = !!plan.observations?.some(
    (obs) => (obs.priority === 'high' || obs.priority === 'critical') && obs.state !== 'closed'
  );

  if (plan.manualStatus === 'watch' || hasActiveHighPriorityObservation) {
    if (finalStatus === 'normal' || finalStatus === 'unknown') {
      finalStatus = 'watch';
    }
  }

  // 5. Build Russian explanation (statusReason)
  let statusReason = '';
  if (finalStatus === 'unknown') {
    statusReason = 'Недостаточно данных для расчета';
  } else if (hasActiveHighPriorityObservation) {
    statusReason = 'Внимание: Активное наблюдение высокой важности';
  } else if (plan.manualStatus === 'watch') {
    statusReason = 'Под присмотром (установлено вручную)';
  } else {
    // Regular status calculations

    if (finalStatus === 'overdue') {
      if (remainingDays !== null && remainingDays < 0 && remainingMileage !== null && remainingMileage < 0) {
        statusReason = `Просрочено на ${pluralizeDays(remainingDays)} и ${Math.abs(remainingMileage)} км`;
      } else if (remainingDays !== null && remainingDays < 0) {
        statusReason = `Просрочено на ${pluralizeDays(remainingDays)}`;
      } else if (remainingMileage !== null && remainingMileage < 0) {
        statusReason = `Просрочено на ${Math.abs(remainingMileage)} км`;
      } else {
        statusReason = 'Срок обслуживания просрочен';
      }
    } else if (finalStatus === 'soon' || finalStatus === 'watch') {
      const prefix = finalStatus === 'soon' ? 'Скоро потребуется: ' : 'Под присмотром: ';
      if (remainingDays !== null && remainingMileage !== null) {
        statusReason = `${prefix}осталось ${remainingDays} дн. или ${remainingMileage} км`;
      } else if (remainingDays !== null) {
        statusReason = `${prefix}осталось ${pluralizeDays(remainingDays)}`;
      } else if (remainingMileage !== null) {
        statusReason = `${prefix}осталось ${remainingMileage} км`;
      }
    } else {
      // Normal
      if (remainingDays !== null && remainingMileage !== null) {
        statusReason = `В норме: осталось ${remainingDays} дн. или ${remainingMileage} км`;
      } else if (remainingDays !== null) {
        statusReason = `В норме: осталось ${pluralizeDays(remainingDays)}`;
      } else if (remainingMileage !== null) {
        statusReason = `В норме: осталось ${remainingMileage} км`;
      } else {
        statusReason = 'В норме';
      }
    }
  }

  return {
    status: finalStatus,
    remainingDays,
    remainingMileage,
    nextDueAt,
    nextDueMileage,
    statusReason,
  };
}

export function calculateReadinessScore(
  plansWithStatuses: {
    status: 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' | 'disabled';
    priority: string;
  }[]
): { score: number; activePlansCount: number } {
  // Only calculate based on active (non-disabled) plans
  const activePlans = plansWithStatuses.filter((p) => p.status !== 'disabled');
  const activeCount = activePlans.length;

  if (activeCount === 0) {
    return { score: 100, activePlansCount: 0 };
  }

  let score = 100;

  // Priority weights mapping
  const priorityWeights: Record<string, number> = {
    normal: 1.0,
    high: 1.5,
    critical: 2.0,
  };

  for (const plan of activePlans) {
    const weight = priorityWeights[plan.priority] || 1.0;
    let penalty = 0;

    switch (plan.status) {
      case 'overdue':
        penalty = 18;
        break;
      case 'soon':
        penalty = 7;
        break;
      case 'watch':
        penalty = 4;
        break;
      case 'unknown':
        penalty = 2;
        break;
      case 'normal':
      default:
        penalty = 0;
        break;
    }

    score -= penalty * weight;
  }

  // Constrain score to [0, 100]
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    activePlansCount: activeCount,
  };
}
