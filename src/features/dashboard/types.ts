export interface VehicleSummary {
  id: string;
  displayName: string;
  isPrimary: boolean;
}

export interface DashboardPlanItem {
  id: string;
  title: string;
  priority: string;
  statusReason: string;
  category: { name: string };
}

export interface DashboardData {
  vehicle: {
    id: string;
    displayName: string;
    currentMileage: number;
    mileageUnit: string;
  };
  readinessScore: number;
  activePlansCount: number;
  plansSummary: Record<'overdue' | 'soon' | 'watch' | 'normal' | 'unknown', number>;
  openObservations: {
    critical: number;
    high: number;
    normal: number;
    total: number;
  };
  urgentItems: DashboardPlanItem[];
  upcomingItems: DashboardPlanItem[];
  watchItems: DashboardPlanItem[];
  lastServiceRecord: {
    id: string;
    performedAt: string;
    mileage: number;
    serviceName: string;
    totalCost: number;
    currency: string;
    notes: string | null;
  } | null;
  expenses: {
    byCurrency: Array<{
      currency: 'USD' | 'BYN' | 'RUB' | 'EUR';
      last30Days: number;
      yearToDate: number;
    }>;
  };
}
