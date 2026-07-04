import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { maintenancePlanSchema } from '@/lib/validation';

async function checkPlanOwnership(planId: string, userId: string) {
  const plan = await prisma.maintenancePlan.findUnique({
    where: { id: planId },
    include: {
      vehicle: true,
    },
  });

  if (!plan) {
    return { errorStatus: 404, errorCode: 'NOT_FOUND', errorMessage: 'План обслуживания не найден' };
  }

  if (plan.vehicle.userId !== userId) {
    return { errorStatus: 403, errorCode: 'FORBIDDEN', errorMessage: 'У вас нет доступа к этому плану обслуживания' };
  }

  return { plan };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { planId } = await params;
    const body = await request.json();

    // 1. Check ownership
    const { errorStatus, errorCode, errorMessage } = await checkPlanOwnership(planId, userId);
    if (errorStatus) {
      return NextResponse.json(
        { error: { code: errorCode, message: errorMessage } },
        { status: errorStatus }
      );
    }

    // 2. Validate update data (partial schema)
    const partialSchema = maintenancePlanSchema.partial();
    const parsed = partialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Ошибка валидации при обновлении плана',
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updateData = parsed.data;

    // Verify category exists if it is being updated
    if (updateData.categoryId) {
      const category = await prisma.maintenanceCategory.findUnique({
        where: { id: updateData.categoryId },
      });

      if (!category) {
        return NextResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Указанная категория обслуживания не найдена',
            },
          },
          { status: 404 }
        );
      }
    }

    // 3. Update the maintenance plan
    const updatedPlan = await prisma.maintenancePlan.update({
      where: { id: planId },
      data: updateData,
    });

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    console.error('Error updating maintenance plan:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при обновлении плана ТО',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { planId } = await params;

    // 1. Check ownership
    const { errorStatus, errorCode, errorMessage } = await checkPlanOwnership(planId, userId);
    if (errorStatus) {
      return NextResponse.json(
        { error: { code: errorCode, message: errorMessage } },
        { status: errorStatus }
      );
    }

    // 2. Soft delete / Archive the plan
    const archivedPlan = await prisma.maintenancePlan.update({
      where: { id: planId },
      data: {
        archivedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'План обслуживания успешно архивирован',
      plan: archivedPlan,
    });
  } catch (error) {
    console.error('Error archiving maintenance plan:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при архивации плана ТО',
        },
      },
      { status: 500 }
    );
  }
}
