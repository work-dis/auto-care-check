import { Prisma, Observation } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/server/shared/apiError';
import { hasVehicleAccess } from '@/server/vehicles/access';

type ObservationInput = {
  title?: string;
  description?: string | null;
  priority?: string;
  state?: string;
  photoUrl?: string | null;
  maintenancePlanId?: string | null;
  serviceRecordId?: string | null;
};

async function getOwnedObservation(observationId: string, userId: string) {
  const observation = await prisma.observation.findUnique({
    where: { id: observationId },
    include: { vehicle: true },
  });
  if (!observation) throw new ApiError(404, 'NOT_FOUND', 'Наблюдение не найдено');
  if (!(await hasVehicleAccess(observation.vehicleId, observation.vehicle.userId, userId, 'editor'))) {
    throw new ApiError(403, 'FORBIDDEN', 'Доступ запрещён');
  }
  return observation;
}

async function assertRelatedResources(
  vehicleId: string,
  input: Pick<ObservationInput, 'maintenancePlanId' | 'serviceRecordId'>,
) {
  if (input.maintenancePlanId) {
    const plan = await prisma.maintenancePlan.findUnique({
      where: { id: input.maintenancePlanId },
      select: { vehicleId: true },
    });
    if (!plan || plan.vehicleId !== vehicleId) {
      throw new ApiError(400, 'INVALID_MAINTENANCE_PLAN', 'План обслуживания не принадлежит этому автомобилю');
    }
  }

  if (input.serviceRecordId) {
    const record = await prisma.serviceRecord.findUnique({
      where: { id: input.serviceRecordId },
      select: { vehicleId: true },
    });
    if (!record || record.vehicleId !== vehicleId) {
      throw new ApiError(400, 'INVALID_SERVICE_RECORD', 'Запись обслуживания не принадлежит этому автомобилю');
    }
  }
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  before: Observation,
  after?: Observation,
) {
  await tx.auditEvent.create({
    data: {
      userId,
      entityType: 'Observation',
      entityId: before.id,
      action,
      beforeJson: JSON.stringify(before),
      afterJson: after ? JSON.stringify(after) : null,
    },
  });
}

export async function updateObservation(
  observationId: string,
  userId: string,
  input: ObservationInput,
) {
  const before = await getOwnedObservation(observationId, userId);
  await assertRelatedResources(before.vehicleId, input);

  const data: Prisma.ObservationUncheckedUpdateInput = { ...input };
  if (input.state) data.closedAt = input.state === 'closed' ? new Date() : null;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.observation.update({
      where: { id: observationId },
      data,
      include: { maintenancePlan: true, serviceRecord: true },
    });
    await writeAudit(tx, userId, 'UPDATE', before, updated);
    return updated;
  });
}

export async function closeObservation(
  observationId: string,
  userId: string,
  serviceRecordId?: string | null,
) {
  const before = await getOwnedObservation(observationId, userId);
  await assertRelatedResources(before.vehicleId, { serviceRecordId });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.observation.update({
      where: { id: observationId },
      data: { state: 'closed', closedAt: new Date(), serviceRecordId: serviceRecordId || null },
      include: { maintenancePlan: true, serviceRecord: true },
    });
    await writeAudit(tx, userId, 'CLOSE', before, updated);
    return updated;
  });
}
