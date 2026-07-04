import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Ownership Authorization Tests', () => {
  let userAId: string;
  let userBId: string;
  let vehicleAId: string;

  beforeAll(async () => {
    // 1. Create User A and User B
    const userA = await prisma.user.create({
      data: {
        email: 'userA@example.com',
        name: 'User A',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: 'userB@example.com',
        name: 'User B',
      },
    });
    userBId = userB.id;

    // 2. User A creates Vehicle A
    const vehicleA = await prisma.vehicle.create({
      data: {
        userId: userAId,
        displayName: "User A's Car",
        make: 'BMW',
        model: 'X5',
        year: 2021,
      },
    });
    vehicleAId = vehicleA.id;
  });

  afterAll(async () => {
    // Cleanup test records
    if (userAId) {
      await prisma.user.delete({ where: { id: userAId } });
    }
    if (userBId) {
      await prisma.user.delete({ where: { id: userBId } });
    }
  });

  // Business logic helper simulating API authorization check
  const checkOwnership = async (vehicleId: string, currentUserId: string) => {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return { error: 'NOT_FOUND', status: 404 };
    }

    if (vehicle.userId !== currentUserId) {
      return { error: 'FORBIDDEN', status: 403 };
    }

    return { vehicle };
  };

  it('should authorize owner (User A) to access their vehicle', async () => {
    const result = await checkOwnership(vehicleAId, userAId);
    expect(result.error).toBeUndefined();
    expect(result.vehicle).toBeDefined();
    expect(result.vehicle?.id).toBe(vehicleAId);
  });

  it('should reject non-owner (User B) from accessing User A\'s vehicle', async () => {
    const result = await checkOwnership(vehicleAId, userBId);
    expect(result.error).toBe('FORBIDDEN');
    expect(result.status).toBe(403);
    expect(result.vehicle).toBeUndefined();
  });

  it('should return 404 if vehicle does not exist', async () => {
    const result = await checkOwnership('non-existent-uuid', userAId);
    expect(result.error).toBe('NOT_FOUND');
    expect(result.status).toBe(404);
  });
});
