import { prisma } from '@/lib/prisma';
import { ApiError } from '@/server/shared/apiError';

export type VehicleRole = 'owner' | 'editor' | 'viewer';

export async function hasVehicleAccess(
  vehicleId: string,
  ownerId: string,
  userId: string,
  minimumRole: 'viewer' | 'editor' | 'owner' = 'viewer',
) {
  if (ownerId === userId) return true;
  if (minimumRole === 'owner') return false;
  const membership = await prisma.vehicleMember.findUnique({
    where: { vehicleId_userId: { vehicleId, userId } },
    select: { role: true },
  });
  if (!membership) return false;
  return minimumRole === 'viewer' || membership.role === 'editor';
}

export async function requireVehicleAccess(
  vehicleId: string,
  userId: string,
  minimumRole: 'viewer' | 'editor' | 'owner' = 'viewer',
) {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      archivedAt: null,
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    include: {
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });
  if (!vehicle) {
    throw new ApiError(404, 'VEHICLE_NOT_FOUND', 'Автомобиль не найден');
  }

  const role: VehicleRole =
    vehicle.userId === userId
      ? 'owner'
      : vehicle.members[0]?.role === 'editor'
        ? 'editor'
        : 'viewer';
  const rank = { viewer: 1, editor: 2, owner: 3 };
  if (rank[role] < rank[minimumRole]) {
    throw new ApiError(403, 'FORBIDDEN', 'Недостаточно прав для этого действия');
  }
  return { vehicle, role };
}
