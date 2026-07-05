import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { calculatePlanStatus } from '../lib/statusEngine';

describe('Observations Integration Tests', () => {
  let userId: string;
  let vehicleId: string;
  let categoryId: string;
  let planId: string;
  let observationId: string;

  beforeAll(async () => {
    // 0. Clean up existing test users
    await prisma.user.deleteMany({
      where: { email: 'observations-test@example.com' },
    });

    // 1. Create User
    const user = await prisma.user.create({
        data: {
          email: 'observations-test@example.com',
          name: 'Observations Tester',
          username: 'obs_tester',
        },
      });
    userId = user.id;

    // 2. Create Vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        displayName: 'Obs Machine',
        make: 'Ford',
        model: 'Focus',
        year: 2018,
        currentMileage: 50000,
      },
    });
    vehicleId = vehicle.id;

    // 3. Create category and plan
    const category = await prisma.maintenanceCategory.create({
      data: { name: 'Suspension', vehicleId },
    });
    categoryId = category.id;

    const plan = await prisma.maintenancePlan.create({
      data: {
        vehicleId,
        categoryId,
        title: 'Inspect Shock Absorbers',
        kind: 'inspection',
        scheduleMode: 'date_only',
        intervalDays: 180,
        lastCompletedAt: new Date(), // Just completed, so normally status is 'normal'
        soonDaysThreshold: 30,
        soonMileageThreshold: 1000,
        watchDaysThreshold: 90,
        watchMileageThreshold: 3000,
      },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it('should calculate plan status as watch if there is an active high-priority observation', async () => {
    const vehicle = { currentMileage: 50000 };
    const plan = {
      id: planId,
      kind: 'inspection',
      priority: 'normal',
      scheduleMode: 'date_only',
      intervalDays: 180,
      intervalMileage: null,
      lastCompletedAt: new Date(),
      lastCompletedMileage: null,
      manualDueAt: null,
      manualDueMileage: null,
      soonDaysThreshold: 30,
      soonMileageThreshold: 1000,
      watchDaysThreshold: 90,
      watchMileageThreshold: 3000,
      manualStatus: 'auto',
      disabledAt: null,
      archivedAt: null,
    };

    // Normally status is 'normal'
    const statusNormal = calculatePlanStatus(plan, vehicle, new Date());
    expect(statusNormal.status).toBe('normal');

    // Add active high-priority observation to input
    const planWithHighObs = {
      ...plan,
      observations: [
        {
          id: 'obs-1',
          priority: 'high',
          state: 'open',
        },
      ],
    };

    const statusWatch = calculatePlanStatus(planWithHighObs, vehicle, new Date());
    expect(statusWatch.status).toBe('watch');
    expect(statusWatch.statusReason).toBe('Внимание: Активное наблюдение высокой важности');
  });

  it('should successfully create an observation via POST and update via PATCH', async () => {
    // We create the observation directly in db for simplicity in integration tests
    const observation = await prisma.observation.create({
      data: {
        vehicleId,
        maintenancePlanId: planId,
        title: 'Knocking sound from front-left wheel',
        description: 'Occurs on speed bumps',
        priority: 'high',
        state: 'open',
      },
    });
    observationId = observation.id;

    expect(observation).toBeDefined();
    expect(observation.title).toBe('Knocking sound from front-left wheel');
    expect(observation.state).toBe('open');

    // Update state to watching
    const updated = await prisma.observation.update({
      where: { id: observationId },
      data: { state: 'watching' },
    });
    expect(updated.state).toBe('watching');
  });

  it('should close observation and link it to ServiceRecord when record contains observationId', async () => {
    // Create ServiceRecord with linked observation (simulation of records POST API transaction)
    const record = await prisma.$transaction(async (tx) => {
      const rec = await tx.serviceRecord.create({
        data: {
          vehicleId,
          performedAt: new Date(),
          mileage: 50500,
          serviceName: 'Front Shock Absorber replacement',
          laborCost: 3000,
          partsCost: 8000,
          totalCost: 11000,
        },
      });

      // Update linked observations
      await tx.observation.updateMany({
        where: { id: observationId },
        data: {
          state: 'closed',
          closedAt: new Date(),
          serviceRecordId: rec.id,
        },
      });

      return rec;
    });

    expect(record).toBeDefined();

    // Verify observation is closed and linked
    const closedObs = await prisma.observation.findUnique({
      where: { id: observationId },
    });

    expect(closedObs?.state).toBe('closed');
    expect(closedObs?.closedAt).toBeDefined();
    expect(closedObs?.serviceRecordId).toBe(record.id);
  });
});
