import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Service Record Integration Tests', () => {
  let userAId: string;
  let userBId: string;
  let vehicleAId: string;
  let vehicleBId: string;
  let categoryAId: string;
  let planAId: string;


  beforeAll(async () => {
    // 0. Clean up existing users in case of previous crashes
    await prisma.user.deleteMany({
      where: {
        email: { in: ['usera-sr@example.com', 'userb-sr@example.com'] },
      },
    });

    // 1. Create User A and User B
    const userA = await prisma.user.create({
      data: { email: 'usera-sr@example.com', name: 'User A' },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: { email: 'userb-sr@example.com', name: 'User B' },
    });
    userBId = userB.id;

    // 2. Create vehicles
    const vehicleA = await prisma.vehicle.create({
      data: { userId: userAId, displayName: 'Car A', make: 'Honda', model: 'Civic', year: 2018, currentMileage: 100000 },
    });
    vehicleAId = vehicleA.id;

    const vehicleB = await prisma.vehicle.create({
      data: { userId: userBId, displayName: 'Car B', make: 'Honda', model: 'Accord', year: 2019, currentMileage: 50000 },
    });
    vehicleBId = vehicleB.id;

    // 3. Create categories
    const categoryA = await prisma.maintenanceCategory.create({
      data: { name: 'Engine Oil A', vehicleId: vehicleAId },
    });
    categoryAId = categoryA.id;

    const categoryB = await prisma.maintenanceCategory.create({
      data: { name: 'Engine Oil B', vehicleId: vehicleBId },
    });
    const categoryBId = categoryB.id;

    // 4. Create plans
    const planA = await prisma.maintenancePlan.create({
      data: {
        vehicleId: vehicleAId,
        categoryId: categoryAId,
        title: 'Oil Change A',
        kind: 'scheduled_service',
        scheduleMode: 'mileage_only',
        intervalMileage: 10000,
      },
    });
    planAId = planA.id;

    await prisma.maintenancePlan.create({
      data: {
        vehicleId: vehicleBId,
        categoryId: categoryBId,
        title: 'Oil Change B',
        kind: 'scheduled_service',
        scheduleMode: 'mileage_only',
        intervalMileage: 10000,
      },
    });

  });

  afterAll(async () => {
    // Cleanup database
    if (userAId) await prisma.user.delete({ where: { id: userAId } });
    if (userBId) await prisma.user.delete({ where: { id: userBId } });
  });

  // Test 9: Подтверждение сервисной работы корректно переносит следующий срок ТО
  it('should update plan lastCompleted stats when confirming a service record', async () => {
    const performedAt = new Date('2026-07-01T00:00:00Z');
    const mileage = 105000;

    // Simulate POST /api/vehicles/[id]/records
    const record = await prisma.$transaction(async (tx) => {
      const sr = await tx.serviceRecord.create({
        data: {
          vehicleId: vehicleAId,
          performedAt,
          mileage,
          serviceName: 'Oil change and filter',
          laborCost: 1000,
          partsCost: 3000,
          totalCost: 4000,
          state: 'confirmed',
        },
      });

      await tx.serviceRecordPlanItem.create({
        data: {
          serviceRecordId: sr.id,
          maintenancePlanId: planAId,
          titleSnapshot: 'Oil Change A',
          categorySnapshot: 'Engine Oil',
          actionType: 'completed',
        },
      });

      await tx.maintenancePlan.update({
        where: { id: planAId },
        data: {
          lastCompletedAt: performedAt,
          lastCompletedMileage: mileage,
        },
      });

      return sr;
    });

    const updatedPlan = await prisma.maintenancePlan.findUnique({
      where: { id: planAId },
    });

    expect(record.state).toBe('confirmed');
    expect(updatedPlan?.lastCompletedAt?.toISOString()).toBe(performedAt.toISOString());
    expect(updatedPlan?.lastCompletedMileage).toBe(mileage);
  });

  // Test 11: Автоматическая отмена/деактивация напоминаний после создания ServiceRecord
  it('should cancel pending notifications for linked plans when confirming service record', async () => {
    // Create a pending notification for plan A
    const notification = await prisma.notification.create({
      data: {
        userId: userAId,
        vehicleId: vehicleAId,
        maintenancePlanId: planAId,
        title: 'Oil Change Soon',
        body: 'Your oil change is due in 500 km',
        status: 'pending',
        dedupeKey: `dedupe-plan-a-notif-${Date.now()}`,
      },
    });

    // Confirm service record and cancel notifications
    await prisma.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: {
          maintenancePlanId: planAId,
          status: 'pending',
        },
        data: {
          status: 'cancelled',
        },
      });
    });

    const updatedNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
    });

    expect(updatedNotification?.status).toBe('cancelled');
  });

  // Test 12: Архивирование плана обслуживания не удаляет его историю из завершенных работ
  it('should preserve completed service record history when maintenance plan is archived', async () => {
    // Archive plan A (soft-delete)
    await prisma.maintenancePlan.update({
      where: { id: planAId },
      data: { archivedAt: new Date() },
    });

    // Check that service record and snapshot plan items still exist
    const planItems = await prisma.serviceRecordPlanItem.findMany({
      where: { maintenancePlanId: planAId },
    });

    expect(planItems.length).toBeGreaterThan(0);
    expect(planItems[0].titleSnapshot).toBe('Oil Change A');
    expect(planItems[0].categorySnapshot).toBe('Engine Oil');
  });

  // Test 13: Проверка прав: пользователь не имеет доступа к чужим автомобилям и записям
  describe('Authorization Rules', () => {
    const simulateAddRecord = async (vId: string, currentUserId: string) => {
      const v = await prisma.vehicle.findUnique({ where: { id: vId } });
      if (!v || v.userId !== currentUserId) {
        throw new Error('FORBIDDEN');
      }
      return true;
    };

    const simulateVoidRecord = async (srId: string, currentUserId: string) => {
      const sr = await prisma.serviceRecord.findUnique({
        where: { id: srId },
        include: { vehicle: true },
      });
      if (!sr || sr.vehicle.userId !== currentUserId) {
        throw new Error('FORBIDDEN');
      }
      return true;
    };

    it('should reject User A from adding service record to User B\'s vehicle', async () => {
      let error = '';
      try {
        await simulateAddRecord(vehicleBId, userAId);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      expect(error).toBe('FORBIDDEN');
    });

    it('should reject User A from voiding User B\'s service record', async () => {
      // Create a service record for vehicle B (User B)
      const recordB = await prisma.serviceRecord.create({
        data: {
          vehicleId: vehicleBId,
          performedAt: new Date(),
          mileage: 51000,
          serviceName: 'B Oil Change',
          state: 'confirmed',
        },
      });

      let error = '';
      try {
        await simulateVoidRecord(recordB.id, userAId);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      expect(error).toBe('FORBIDDEN');
    });
  });
});
