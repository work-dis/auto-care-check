import { ApiError } from '@/server/shared/apiError';

export interface OdometerChange {
  currentMileage: number;
  mileage: number;
  source: 'manual' | 'service_record' | 'import' | 'correction';
  comment?: string | null;
}

export function assertValidOdometerChange(change: OdometerChange) {
  if (change.mileage >= change.currentMileage) return;

  if (change.source !== 'correction' || !change.comment?.trim()) {
    throw new ApiError(
      400,
      'INVALID_MILEAGE_DECREASE',
      'Уменьшение пробега допускается только как корректировка с обязательной причиной.',
      {
        mileage: 'Выберите тип «Корректировка» и укажите причину',
      },
    );
  }
}

export function assertServiceMileage(currentMileage: number, serviceMileage: number) {
  if (serviceMileage < currentMileage) {
    throw new ApiError(
      400,
      'SERVICE_MILEAGE_BELOW_CURRENT',
      'Пробег в подтверждённой работе не может быть меньше текущего пробега автомобиля.',
      {
        mileage: 'Сначала скорректируйте текущий пробег отдельной операцией с указанием причины',
      },
    );
  }
}
