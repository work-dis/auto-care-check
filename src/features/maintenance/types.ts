export interface VehicleSummary {
  id: string;
  displayName: string;
  isPrimary: boolean;
}

export interface Category {
  id: string;
  name: string;
  iconKey: string | null;
}

export interface MaintenancePlan {
  id: string;
  categoryId: string;
  category: Category;
  title: string;
  description: string | null;
  kind: string;
  priority: 'normal' | 'high' | 'critical';
  scheduleMode: string;
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
  status?: 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' | 'disabled';
  statusReason?: string;
  nextDueAt?: string | null;
  nextDueMileage?: number | null;
}

export type PlanPriority = 'normal' | 'high' | 'critical';
export type PlanScheduleMode = 'date_only' | 'mileage_only' | 'whichever_comes_first' | 'manual';
export type StatusFilter = 'all' | 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' | 'disabled';
