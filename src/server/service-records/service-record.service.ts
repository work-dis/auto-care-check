import { Vehicle } from '@prisma/client';
import { z } from 'zod';
import { assertServiceMileage } from '@/domain/odometer/rules';
import { prisma } from '@/lib/prisma';
import { serviceRecordSchema } from '@/lib/validation';
import { ApiError } from '@/server/shared/apiError';

type ServiceRecordInput = z.infer<typeof serviceRecordSchema>;

export async function createConfirmedServiceRecord(
  vehicle: Vehicle,
  userId: string,
  input: ServiceRecordInput,
) {
  assertServiceMileage(vehicle.currentMileage, input.mileage);

  const [plans, observations] = await Promise.all([
    input.planIds.length
      ? prisma.maintenancePlan.findMany({
          where: { id: { in: input.planIds } },
          include: { category: true },
        })
      : [],
    input.observationIds.length
      ? prisma.observation.findMany({ where: { id: { in: input.observationIds } } })
      : [],
  ]);

  if (plans.length !== input.planIds.length || plans.some((plan) => plan.vehicleId !== vehicle.id)) {
    throw new ApiError(400, 'INVALID_MAINTENANCE_PLAN', 'Работы не принадлежат этому автомобилю');
  }
  if (
    observations.length !== input.observationIds.length ||
    observations.some((observation) => observation.vehicleId !== vehicle.id)
  ) {
    throw new ApiError(400, 'INVALID_OBSERVATION', 'Наблюдения не принадлежат этому автомобилю');
  }

  return prisma.$transaction(async (tx) => {
    const record = await tx.serviceRecord.create({
      data: {
        vehicleId: vehicle.id,
        performedAt: input.performedAt,
        mileage: input.mileage,
        serviceName: input.serviceName,
        serviceContact: input.serviceContact,
        laborCost: input.laborCost,
        partsCost: input.partsCost,
        totalCost: input.laborCost + input.partsCost,
        currency: input.currency,
        notes: input.notes,
        state: 'confirmed',
      },
    });

    for (const plan of plans) {
      await tx.serviceRecordPlanItem.create({
        data: {
          serviceRecordId: record.id,
          maintenancePlanId: plan.id,
          titleSnapshot: plan.title,
          categorySnapshot: plan.category.name,
          actionType: 'completed',
          costSnapshot: 0,
        },
      });
      await tx.maintenancePlan.update({
        where: { id: plan.id },
        data: {
          lastCompletedAt: input.performedAt,
          lastCompletedMileage: input.mileage,
        },
      });
    }

    if (input.planIds.length) {
      await tx.notification.updateMany({
        where: {
          maintenancePlanId: { in: input.planIds },
          status: { in: ['pending', 'processing'] },
        },
        data: { status: 'cancelled', processingAt: null },
      });
    }

    if (input.mileage > vehicle.currentMileage) {
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { currentMileage: input.mileage },
      });
      await tx.odometerReading.create({
        data: {
          vehicleId: vehicle.id,
          mileage: input.mileage,
          source: 'service_record',
          recordedAt: input.performedAt,
          comment: `Запись обслуживания: ${input.serviceName}`,
        },
      });
    }

    if (input.observationIds.length) {
      await tx.observation.updateMany({
        where: { id: { in: input.observationIds } },
        data: {
          state: 'closed',
          closedAt: input.performedAt,
          serviceRecordId: record.id,
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        userId,
        entityType: 'ServiceRecord',
        entityId: record.id,
        action: 'CREATE',
        afterJson: JSON.stringify(record),
      },
    });
    return record;
  });
}
