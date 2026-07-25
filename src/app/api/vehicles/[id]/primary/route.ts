import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, archivedAt: null },
    select: { id: true },
  });

  if (!vehicle) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Автомобиль не найден' } },
      { status: 404 },
    );
  }

  await prisma.$transaction([
    prisma.vehicle.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.vehicle.update({
      where: { id },
      data: { isPrimary: true },
    }),
  ]);

  return NextResponse.json({ ok: true, vehicleId: id });
}
