import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { recordId } = await params;
    const body = await request.json();

    const { voidReason } = body;
    if (!voidReason || !voidReason.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Укажите причину отмены работы' } },
        { status: 400 }
      );
    }

    // 1. Fetch record and check ownership
    const serviceRecord = await prisma.serviceRecord.findUnique({
      where: { id: recordId },
      include: {
        vehicle: true,
        planItems: true,
      },
    });

    if (!serviceRecord) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Запись обслуживания не найдена' } },
        { status: 404 }
      );
    }

    if (serviceRecord.vehicle.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    if (serviceRecord.state === 'voided') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Запись уже была отменена' } },
        { status: 400 }
      );
    }

    // 2. Perform voiding logic in transaction
    const resultRecord = await prisma.$transaction(async (tx) => {
      // A. Update record state to voided
      const updated = await tx.serviceRecord.update({
        where: { id: recordId },
        data: {
          state: 'voided',
          voidReason: voidReason.trim(),
        },
      });

      // B. Recalculate previous completed details for each linked MaintenancePlan
      for (const planItem of serviceRecord.planItems) {
        if (planItem.maintenancePlanId) {
          // Find the latest confirmed ServiceRecord that is linked to this MaintenancePlan
          const latestConfirmedRecord = await tx.serviceRecord.findFirst({
            where: {
              vehicleId: serviceRecord.vehicleId,
              state: 'confirmed',
              planItems: {
                some: {
                  maintenancePlanId: planItem.maintenancePlanId,
                },
              },
            },
            orderBy: [
              { performedAt: 'desc' },
              { mileage: 'desc' },
            ],
          });

          if (latestConfirmedRecord) {
            await tx.maintenancePlan.update({
              where: { id: planItem.maintenancePlanId },
              data: {
                lastCompletedAt: latestConfirmedRecord.performedAt,
                lastCompletedMileage: latestConfirmedRecord.mileage,
              },
            });
          } else {
            await tx.maintenancePlan.update({
              where: { id: planItem.maintenancePlanId },
              data: {
                lastCompletedAt: null,
                lastCompletedMileage: null,
              },
            });
          }
        }
      }

      // C. Write AuditEvent
      await tx.auditEvent.create({
        data: {
          userId,
          entityType: 'ServiceRecord',
          entityId: recordId,
          action: 'VOID',
          afterJson: JSON.stringify(updated),
        },
      });

      return updated;
    });

    return NextResponse.json({ serviceRecord: resultRecord });
  } catch (error) {
    console.error('Error voiding service record:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при отмене выполненной работы' } },
      { status: 500 }
    );
  }
}
