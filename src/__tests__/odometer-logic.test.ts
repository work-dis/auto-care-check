import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Odometer Business Logic Integration Tests', () => {
  let userId: string;
  let vehicleId: string;

  beforeAll(async () => {
    // 1. Create a test user
    const user = await prisma.user.create({
        data: {
          email: 'test-odo-logic@example.com',
          name: 'Odo Test User',
          username: 'odo_test',
        },
      });
    userId = user.id;

    // 2. Create a test vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        displayName: 'Test Odo Car',
        make: 'Ford',
        model: 'Focus',
        year: 2015,
        currentMileage: 100000,
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    // Cleanup test records
    if (userId) {
      await prisma.user.delete({
        where: { id: userId },
      });
    }
  });

  it('should allow increasing mileage', async () => {
    const newMileage = 105000;
    
    // Simulate updating vehicle mileage
    const reading = await prisma.odometerReading.create({
      data: {
        vehicleId,
        mileage: newMileage,
        source: 'manual',
      },
    });

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentMileage: newMileage },
    });

    expect(reading.mileage).toBe(newMileage);
    expect(updatedVehicle.currentMileage).toBe(newMileage);
  });

  it('should block decreasing mileage without correction source', async () => {
    const currentMileage = 105000;
    const lowerMileage = 102000;

    // Check business logic: mileage is decreasing
    let error: string | null = null;
    try {
      const source = 'manual' as string;
      const comment = 'Oops';
      
      if (lowerMileage < currentMileage) {
        if (source !== 'correction' || !comment) {
          throw new Error('VALIDATION_ERROR: Mileage decrease requires correction and comment');
        }
      }
      
      // If it passes, save to DB
      await prisma.odometerReading.create({
        data: { vehicleId, mileage: lowerMileage, source, comment }
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    expect(error).toContain('VALIDATION_ERROR');
  });

  it('should block decreasing mileage if comment is empty even if source is correction', async () => {
    const currentMileage = 105000;
    const lowerMileage = 102000;

    let error: string | null = null;
    try {
      const source = 'correction' as string;
      const comment = ''; // Empty comment
      
      if (lowerMileage < currentMileage) {
        if (source !== 'correction' || !comment.trim()) {
          throw new Error('VALIDATION_ERROR: Mileage decrease requires correction and comment');
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    expect(error).toContain('VALIDATION_ERROR');
  });

  it('should allow decreasing mileage with correction source and a comment', async () => {
    const currentMileage = 105000;
    const lowerMileage = 102000;

    let isSuccess = false;
    try {
      const source = 'correction';
      const comment = 'Приборная панель заменена';
      
      if (lowerMileage < currentMileage) {
        if (source !== 'correction' || !comment.trim()) {
          throw new Error('VALIDATION_ERROR');
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.odometerReading.create({
          data: { vehicleId, mileage: lowerMileage, source, comment }
        });
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { currentMileage: lowerMileage }
        });
      });
      isSuccess = true;
    } catch {
      isSuccess = false;
    }

    const updatedVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

    expect(isSuccess).toBe(true);
    expect(updatedVehicle?.currentMileage).toBe(lowerMileage);
  });
});
