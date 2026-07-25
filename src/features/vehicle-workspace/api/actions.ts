import { jsonRequest, requestWorkspaceApi } from './client';

export function archiveMaintenancePlan(planId: string) {
  return requestWorkspaceApi(`/api/plans/${planId}`, jsonRequest('DELETE'));
}

export function closeObservation(observationId: string, serviceRecordId?: string) {
  return requestWorkspaceApi(
    `/api/observations/${observationId}/close`,
    jsonRequest('POST', { serviceRecordId })
  );
}

export function deleteObservation(observationId: string) {
  return requestWorkspaceApi(
    `/api/observations/${observationId}`,
    jsonRequest('DELETE')
  );
}

export function createReminderRule(
  maintenancePlanId: string,
  triggerType: string,
  triggerValue: string
) {
  return requestWorkspaceApi(
    '/api/reminder-rules',
    jsonRequest('POST', {
      maintenancePlanId,
      triggerType,
      triggerValue,
      sendAtLocalTime: '09:00',
      isEnabled: true,
    })
  );
}

export function deleteReminderRule(ruleId: string) {
  return requestWorkspaceApi(
    `/api/reminder-rules/${ruleId}`,
    jsonRequest('DELETE')
  );
}
