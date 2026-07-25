export interface Vehicle {
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
  status?: 'overdue' | 'soon' | 'watch' | 'normal' | 'unknown' | 'disabled';
  statusReason?: string;
  nextDueAt?: string | null;
  nextDueMileage?: number | null;
  remainingDays?: number | null;
  remainingMileage?: number | null;
}

export interface ServiceRecordPlanItem {
  id: string;
  serviceRecordId: string;
  maintenancePlanId: string | null;
  titleSnapshot: string;
  categorySnapshot: string;
  actionType: string;
}

export interface ServiceRecord {
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

export interface ReminderRule {
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

export interface Observation {
  id: string;
  vehicleId: string;
  maintenancePlanId: string | null;
  maintenancePlan?: {
    id: string;
    title: string;
    category: { name: string };
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
