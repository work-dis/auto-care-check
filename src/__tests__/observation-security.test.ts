import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { closeObservation, updateObservation } from '@/server/observations/observation.service';
import { ApiError } from '@/server/shared/apiError';

describe('Observation ownership regression', () => {
  let ownerId = '';
  let observationId = '';
  let foreignRecordId = '';
  let foreignPlanId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { username: { in: ['security_owner', 'security_foreign'] } },
    });
    const [owner, foreign] = await Promise.all([
      prisma.user.create({ data: { username: 'security_owner', name: 'Owner' } }),
      prisma.user.create({ data: { username: 'security_foreign', name: 'Foreign' } }),
    ]);
    ownerId = owner.id;
    const [ownerVehicle, foreignVehicle] = await Promise.all([
      prisma.vehicle.create({
        data: { userId: owner.id, displayName: 'Owner car', make: 'A', model: 'B', year: 2020 },
      }),
      prisma.vehicle.create({
        data: { userId: foreign.id, displayName: 'Foreign car', make: 'C', model: 'D', year: 2021 },
      }),
    ]);
    const category = await prisma.maintenanceCategory.create({
      data: { name: 'Security category', isSystem: true },
    });
    const [observation, record, plan] = await Promise.all([
      prisma.observation.create({
        data: { vehicleId: ownerVehicle.id, title: 'Noise' },
      }),
      prisma.serviceRecord.create({
        data: {
          vehicleId: foreignVehicle.id,
          performedAt: new Date(),
          mileage: 100,
          serviceName: 'Foreign service',
        },
      }),
      prisma.maintenancePlan.create({
        data: {
          vehicleId: foreignVehicle.id,
          categoryId: category.id,
          title: 'Foreign plan',
          kind: 'inspection',
          scheduleMode: 'manual',
          manualDueMileage: 1000,
        },
      }),
    ]);
    observationId = observation.id;
    foreignRecordId = record.id;
    foreignPlanId = plan.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { username: { in: ['security_owner', 'security_foreign'] } },
    });
    await prisma.maintenanceCategory.deleteMany({ where: { name: 'Security category' } });
    await prisma.$disconnect();
  });

  it('rejects linking a foreign service record', async () => {
    await expect(closeObservation(observationId, ownerId, foreignRecordId)).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects linking a foreign maintenance plan', async () => {
    await expect(
      updateObservation(observationId, ownerId, { maintenancePlanId: foreignPlanId }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
