import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  fuelEntrySchema,
  tireSetSchema,
  vehicleDocumentSchema,
  vehicleMemberSchema,
} from '@/lib/validation';
import { apiErrorResponse, ApiError } from '@/server/shared/apiError';
import { requireVehicleAccess } from '@/server/vehicles/access';
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/domain/money/currencies';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;
    const { vehicle, role } = await requireVehicleAccess(id, userId);
    const [documents, tireSets, fuelEntries, members] = await Promise.all([
      prisma.vehicleDocument.findMany({
        where: { vehicleId: id },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.tireSet.findMany({
        where: { vehicleId: id },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.fuelEntry.findMany({
        where: { vehicleId: id },
        orderBy: [{ mileage: 'desc' }, { filledAt: 'desc' }],
      }),
      prisma.vehicleMember.findMany({
        where: { vehicleId: id },
        include: { user: { select: { username: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const costByCurrency = new Map<SupportedCurrency, number>(
      SUPPORTED_CURRENCIES.map((currency) => [currency, 0]),
    );
    for (const entry of fuelEntries) {
      if (SUPPORTED_CURRENCIES.includes(entry.currency as SupportedCurrency)) {
        const currency = entry.currency as SupportedCurrency;
        costByCurrency.set(currency, (costByCurrency.get(currency) || 0) + Number(entry.totalCost));
      }
    }
    const chronologicalFullTanks = fuelEntries
      .filter((entry) => entry.fullTank)
      .sort((a, b) => a.mileage - b.mileage);
    let distance = 0;
    let consumedLiters = 0;
    for (let index = 1; index < chronologicalFullTanks.length; index += 1) {
      const previous = chronologicalFullTanks[index - 1];
      const current = chronologicalFullTanks[index];
      if (current.mileage > previous.mileage) {
        distance += current.mileage - previous.mileage;
        consumedLiters += Number(current.liters);
      }
    }

    return NextResponse.json({
      vehicle: {
        id: vehicle.id,
        displayName: vehicle.displayName,
        currentMileage: vehicle.currentMileage,
        mileageUnit: vehicle.mileageUnit,
      },
      role,
      documents,
      tireSets,
      fuelEntries,
      members,
      analytics: {
        totalLiters: fuelEntries.reduce((sum, entry) => sum + Number(entry.liters), 0),
        averageConsumption: distance > 0 ? (consumedLiters / distance) * 100 : null,
        costByCurrency: [...costByCurrency.entries()]
          .filter(([, total]) => total > 0)
          .map(([currency, total]) => ({ currency, total })),
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось загрузить данные эксплуатации');
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;
    const body = await request.json();
    const kind = body.kind as string;
    const minimumRole = kind === 'member' ? 'owner' : 'editor';
    const { vehicle } = await requireVehicleAccess(id, userId, minimumRole);

    if (kind === 'document') {
      const data = vehicleDocumentSchema.parse(body.data);
      const document = await prisma.vehicleDocument.create({ data: { vehicleId: id, ...data } });
      return NextResponse.json({ item: document }, { status: 201 });
    }
    if (kind === 'tire') {
      const data = tireSetSchema.parse(body.data);
      if (data.status === 'installed') {
        await prisma.tireSet.updateMany({
          where: { vehicleId: id, status: 'installed' },
          data: { status: 'storage' },
        });
      }
      const tireSet = await prisma.tireSet.create({ data: { vehicleId: id, ...data } });
      return NextResponse.json({ item: tireSet }, { status: 201 });
    }
    if (kind === 'fuel') {
      const data = fuelEntrySchema.parse(body.data);
      const entry = await prisma.$transaction(async (tx) => {
        const created = await tx.fuelEntry.create({ data: { vehicleId: id, ...data } });
        if (data.mileage > vehicle.currentMileage) {
          await tx.vehicle.update({
            where: { id },
            data: { currentMileage: data.mileage },
          });
          await tx.odometerReading.create({
            data: {
              vehicleId: id,
              mileage: data.mileage,
              recordedAt: data.filledAt,
              source: 'manual',
              comment: 'Пробег обновлён по записи о заправке',
            },
          });
        }
        return created;
      });
      return NextResponse.json({ item: entry }, { status: 201 });
    }
    if (kind === 'member') {
      const data = vehicleMemberSchema.parse(body.data);
      const memberUser = await prisma.user.findUnique({
        where: { username: data.username.toLowerCase() },
        select: { id: true },
      });
      if (!memberUser || memberUser.id === userId) {
        throw new ApiError(400, 'INVALID_MEMBER', 'Пользователь не найден или уже владеет автомобилем');
      }
      const member = await prisma.vehicleMember.upsert({
        where: { vehicleId_userId: { vehicleId: id, userId: memberUser.id } },
        create: { vehicleId: id, userId: memberUser.id, role: data.role },
        update: { role: data.role },
      });
      return NextResponse.json({ item: member }, { status: 201 });
    }
    throw new ApiError(400, 'INVALID_KIND', 'Неизвестный тип записи');
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось сохранить запись эксплуатации');
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;
    const body = await request.json();
    const kind = body.kind as string;
    await requireVehicleAccess(id, userId, kind === 'member' ? 'owner' : 'editor');
    const where = { id: String(body.itemId), vehicleId: id };

    if (kind === 'document') await prisma.vehicleDocument.deleteMany({ where });
    else if (kind === 'tire') await prisma.tireSet.deleteMany({ where });
    else if (kind === 'fuel') await prisma.fuelEntry.deleteMany({ where });
    else if (kind === 'member') await prisma.vehicleMember.deleteMany({ where });
    else throw new ApiError(400, 'INVALID_KIND', 'Неизвестный тип записи');

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось удалить запись эксплуатации');
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;
    const { vehicle } = await requireVehicleAccess(id, userId, 'editor');
    const body = await request.json();
    if (body.kind !== 'tire' || !['installed', 'storage', 'retired'].includes(body.status)) {
      throw new ApiError(400, 'INVALID_ACTION', 'Некорректное действие');
    }
    const tire = await prisma.tireSet.findFirst({
      where: { id: String(body.itemId), vehicleId: id },
    });
    if (!tire) throw new ApiError(404, 'TIRE_NOT_FOUND', 'Комплект шин не найден');

    await prisma.$transaction(async (tx) => {
      if (body.status === 'installed') {
        const currentlyInstalled = await tx.tireSet.findMany({
          where: { vehicleId: id, status: 'installed', id: { not: tire.id } },
        });
        for (const current of currentlyInstalled) {
          const addedDistance = current.installedMileage === null
            ? 0
            : Math.max(0, vehicle.currentMileage - current.installedMileage);
          await tx.tireSet.update({
            where: { id: current.id },
            data: {
              status: 'storage',
              totalDistance: { increment: addedDistance },
              installedAt: null,
              installedMileage: null,
            },
          });
        }
        await tx.tireSet.update({
          where: { id: tire.id },
          data: {
            status: 'installed',
            installedAt: new Date(),
            installedMileage: vehicle.currentMileage,
          },
        });
      } else {
        const addedDistance =
          tire.status === 'installed' && tire.installedMileage !== null
            ? Math.max(0, vehicle.currentMileage - tire.installedMileage)
            : 0;
        await tx.tireSet.update({
          where: { id: tire.id },
          data: {
            status: body.status,
            totalDistance: { increment: addedDistance },
            installedAt: null,
            installedMileage: null,
          },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось обновить комплект шин');
  }
}
