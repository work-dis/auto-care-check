'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  Category,
  MaintenancePlan,
  Observation,
  ReminderRule,
  ServiceRecord,
  Vehicle,
} from '../types';
import { requestWorkspaceApi } from '../api/client';

interface VehicleResponse {
  vehicle: Vehicle;
}

interface PlansResponse {
  plans: MaintenancePlan[];
}

interface RecordsResponse {
  serviceRecords: ServiceRecord[];
}

interface RulesResponse {
  reminderRules: ReminderRule[];
}

interface ObservationsResponse {
  observations: Observation[];
}

interface CategoriesResponse {
  categories: Category[];
}

export function useVehicleWorkspace(vehicleId: string) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [progressNowMs, setProgressNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const vehicleData = await requestWorkspaceApi<VehicleResponse>(
        `/api/vehicles/${vehicleId}`
      );

      const [plansData, recordsData, rulesData, observationsData, categoriesData] =
        await Promise.all([
          requestWorkspaceApi<PlansResponse>(`/api/vehicles/${vehicleId}/plans`),
          requestWorkspaceApi<RecordsResponse>(`/api/vehicles/${vehicleId}/records`),
          requestWorkspaceApi<RulesResponse>(`/api/reminder-rules?vehicleId=${vehicleId}`),
          requestWorkspaceApi<ObservationsResponse>(
            `/api/vehicles/${vehicleId}/observations`
          ),
          requestWorkspaceApi<CategoriesResponse>(`/api/categories?vehicleId=${vehicleId}`),
        ]);

      setVehicle(vehicleData.vehicle);
      setPlans(plansData.plans);
      setServiceRecords(recordsData.serviceRecords);
      setReminderRules(rulesData.reminderRules);
      setObservations(observationsData.observations);
      setCategories(categoriesData.categories);
      setProgressNowMs(Date.now());
    } catch (requestError) {
      console.error(requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось загрузить данные автомобиля'
      );
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    // Initial client-side fetch is the external synchronization owned by this hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return {
    vehicle,
    plans,
    serviceRecords,
    reminderRules,
    observations,
    categories,
    progressNowMs,
    isLoading,
    error,
    refresh,
    setReminderRules,
  };
}
