import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { serviceRecordSchema } from '@/lib/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;
    const body = await request.json();

    // 1. Fetch vehicle and verify ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Автомобиль не найден' } },
        { status: 404 }
      );
    }

    if (vehicle.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    // 2. Validate input
    const parsed = serviceRecordSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Неверные данные формы', details: fieldErrors } },
        { status: 400 }
      );
    }

    const {
      performedAt,
      mileage,
      serviceName,
      serviceContact,
      laborCost,
      partsCost,
      currency,
      notes,
      planIds,
      observationIds,
    } = parsed.data;

    // 3. Verify that all selected plans and observations belong to this vehicle
    if (planIds.length > 0) {
      const plans = await prisma.maintenancePlan.findMany({
        where: {
          id: { in: planIds },
        },
      });

      const invalidPlan = plans.find((p) => p.vehicleId !== vehicleId);
      if (invalidPlan || plans.length !== planIds.length) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'Указанные регламентные работы не принадлежат этому автомобилю' } },
          { status: 400 }
        );
      }
    }

    if (observationIds.length > 0) {
      const observations = await prisma.observation.findMany({
        where: {
          id: { in: observationIds },
        },
      });

      const invalidObs = observations.find((o) => o.vehicleId !== vehicleId);
      if (invalidObs || observations.length !== observationIds.length) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'Указанные наблюдения не принадлежат этому автомобилю' } },
          { status: 400 }
        );
      }
    }


    // 4. Create record in a database transaction
    const totalCost = laborCost + partsCost;

    const resultRecord = await prisma.$transaction(async (tx) => {
      // A. Create ServiceRecord
      const record = await tx.serviceRecord.create({
        data: {
          vehicleId,
          performedAt: new Date(performedAt),
          mileage,
          serviceName,
          serviceContact,
          laborCost,
          partsCost,
          totalCost,
          currency,
          notes,
          state: 'confirmed',
        },
      });

      // B. Create snapshots and update plans
      if (planIds.length > 0) {
        const plans = await tx.maintenancePlan.findMany({
          where: { id: { in: planIds } },
          include: { category: true },
        });

        for (const plan of plans) {
          // Create ServiceRecordPlanItem
          await tx.serviceRecordPlanItem.create({
            data: {
              serviceRecordId: record.id,
              maintenancePlanId: plan.id,
              titleSnapshot: plan.title,
              categorySnapshot: plan.category.name,
              actionType: 'completed',
              costSnapshot: 0,
            },
          });

          // Update MaintenancePlan last completed details
          await tx.maintenancePlan.update({
            where: { id: plan.id },
            data: {
              lastCompletedAt: new Date(performedAt),
              lastCompletedMileage: mileage,
            },
          });
        }

        // C. Cancel/Stale old reminders for this cycle
        await tx.notification.updateMany({
          where: {
            maintenancePlanId: { in: planIds },
            status: 'pending',
          },
          data: {
            status: 'cancelled',
          },
        });
      }

      // D. Update vehicle odometer if record is newer
      if (mileage > vehicle.currentMileage) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { currentMileage: mileage },
        });

        // Add OdometerReading log
        await tx.odometerReading.create({
          data: {
            vehicleId,
            mileage,
            source: 'service_record',
            recordedAt: new Date(performedAt),
            comment: `Запись обслуживания: ${serviceName}`,
          },
        });
      }

      // E. Update linked observations (close them and associate with ServiceRecord)
      if (observationIds.length > 0) {
        await tx.observation.updateMany({
          where: { id: { in: observationIds } },
          data: {
            state: 'closed',
            closedAt: new Date(performedAt),
            serviceRecordId: record.id,
          },
        });
      }

      // F. Write AuditEvent
      await tx.auditEvent.create({
        data: {
          userId,
          entityType: 'ServiceRecord',
          entityId: record.id,
          action: 'CREATE',
          afterJson: JSON.stringify(record),
        },
      });

      return record;
    });

    return NextResponse.json({ serviceRecord: resultRecord }, { status: 201 });
  } catch (error) {
    console.error('Error creating service record:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при сохранении выполненной работы' } },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;

    // 1. Verify vehicle and ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Автомобиль не найден' } },
        { status: 404 }
      );
    }

    if (vehicle.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    // 2. Fetch service records ordered by date desc
    const records = await prisma.serviceRecord.findMany({
      where: { vehicleId },
      include: {
        planItems: true,
      },
      orderBy: {
        performedAt: 'desc',
      },
    });

    return NextResponse.json({ serviceRecords: records });
  } catch (error) {
    console.error('Error fetching service records:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при получении истории обслуживания' } },
      { status: 500 }
    );
  }
}
