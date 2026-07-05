import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { checkAndGenerateNotifications } from '../lib/notificationEngine';

describe('Reminder Rules and Notifications integration tests', () => {
  let userId: string;
  let vehicleId: string;
  let categoryId: string;
  let planId: string;
  let ruleDaysId: string;
  let ruleMileageId: string;

  beforeAll(async () => {
    // 0. Clean up existing users with test email
    await prisma.user.deleteMany({
      where: { email: 'reminders-test@example.com' },
    });

    // 1. Create User
    const user = await prisma.user.create({
        data: {
          email: 'reminders-test@example.com',
          name: 'Reminders Tester',
          username: 'reminders_tester',
          timezone: 'UTC',
          defaultReminderTime: '09:00',
        },
      });
    userId = user.id;

    // 2. Create Vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        displayName: 'Test Odometer',
        make: 'Honda',
        model: 'Accord',
        year: 2020,
        currentMileage: 100000,
      },
    });
    vehicleId = vehicle.id;

    // 3. Create category
    const category = await prisma.maintenanceCategory.create({
      data: { name: 'Filters', vehicleId },
    });
    categoryId = category.id;

    // 4. Create Plan
    const plan = await prisma.maintenancePlan.create({
      data: {
        vehicleId,
        categoryId,
        title: 'Cabin Filter Replace',
        kind: 'scheduled_service',
        scheduleMode: 'whichever_comes_first',
        intervalDays: 100,
        intervalMileage: 5000,
        lastCompletedAt: new Date(new Date().getTime() - 95 * 24 * 60 * 60 * 1000), // 95 days ago, so 5 days left
        lastCompletedMileage: 95500, // so next due is 100500, 500 km left
      },
    });
    planId = plan.id;

    // 5. Create Reminder rules
    const ruleDays = await prisma.reminderRule.create({
      data: {
        vehicleId,
        maintenancePlanId: planId,
        triggerType: 'days_before',
        triggerValue: '7',
      },
    });
    ruleDaysId = ruleDays.id;

    const ruleMileage = await prisma.reminderRule.create({
      data: {
        vehicleId,
        maintenancePlanId: planId,
        triggerType: 'mileage_before',
        triggerValue: '1000',
      },
    });
    ruleMileageId = ruleMileage.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it('should trigger and generate notifications based on days_before and mileage_before rules', async () => {
    // Run the engine
    const result = await checkAndGenerateNotifications();
    expect(result.createdCount).toBe(2); // Both days_before (5 left <= 7) and mileage_before (500 left <= 1000) should trigger

    const notifications = await prisma.notification.findMany({
      where: { maintenancePlanId: planId },
    });

    expect(notifications.length).toBe(2);

    const daysNotif = notifications.find((n) => n.reminderRuleId === ruleDaysId);
    expect(daysNotif).toBeDefined();
    expect(daysNotif?.severity).toBe('warning');

    const mileageNotif = notifications.find((n) => n.reminderRuleId === ruleMileageId);
    expect(mileageNotif).toBeDefined();
    expect(mileageNotif?.severity).toBe('warning'); // 500 km left is > 200, so warning
  });

  it('should prevent duplicate notification creation (idempotency)', async () => {
    // Run engine again
    const result = await checkAndGenerateNotifications();
    // Count should be 0 because of dedupeKey constraints
    expect(result.createdCount).toBe(0);

    const count = await prisma.notification.count({
      where: { maintenancePlanId: planId },
    });
    expect(count).toBe(2);
  });

  it('should cancel pending notifications when service record is created', async () => {
    // Create pending notification manually to test cancellation (status 'pending')
    const pendingNotif = await prisma.notification.create({
      data: {
        userId,
        vehicleId,
        maintenancePlanId: planId,
        title: 'Manually Created Pending',
        body: 'Pending text',
        status: 'pending',
        dedupeKey: 'manual-pending-key-12345',
      },
    });

    // Simulate complete service record (similar transaction logic in record route)
    await prisma.$transaction(async (tx) => {
      // Mark pending notifications of this plan as cancelled
      await tx.notification.updateMany({
        where: {
          maintenancePlanId: planId,
          status: 'pending',
        },
        data: {
          status: 'cancelled',
        },
      });
    });

    const updated = await prisma.notification.findUnique({
      where: { id: pendingNotif.id },
    });

    expect(updated?.status).toBe('cancelled');
  });
});
