import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { reminderRuleSchema } from '@/lib/validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { ruleId } = await params;
    const body = await request.json();

    // Check reminder rule existence and ownership
    const rule = await prisma.reminderRule.findUnique({
      where: { id: ruleId },
      include: { vehicle: true },
    });

    if (!rule) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Правило напоминания не найдено' } },
        { status: 404 }
      );
    }

    if (rule.vehicle?.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    // Partial schema validation
    const partialSchema = reminderRuleSchema.partial();
    const validation = partialSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Некорректные параметры обновления', fieldErrors } },
        { status: 400 }
      );
    }

    const updated = await prisma.reminderRule.update({
      where: { id: ruleId },
      data: validation.data,
    });

    // Write AuditEvent
    await prisma.auditEvent.create({
      data: {
        userId,
        entityType: 'ReminderRule',
        entityId: ruleId,
        action: 'UPDATE',
        beforeJson: JSON.stringify(rule),
        afterJson: JSON.stringify(updated),
      },
    });

    return NextResponse.json({ reminderRule: updated });
  } catch (error) {
    console.error('Error updating reminder rule:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при обновлении правила' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { ruleId } = await params;

    // Check reminder rule existence and ownership
    const rule = await prisma.reminderRule.findUnique({
      where: { id: ruleId },
      include: { vehicle: true },
    });

    if (!rule) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Правило напоминания не найдено' } },
        { status: 404 }
      );
    }

    if (rule.vehicle?.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    await prisma.reminderRule.delete({
      where: { id: ruleId },
    });

    // Write AuditEvent
    await prisma.auditEvent.create({
      data: {
        userId,
        entityType: 'ReminderRule',
        entityId: ruleId,
        action: 'DELETE',
        beforeJson: JSON.stringify(rule),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reminder rule:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при удалении правила' } },
      { status: 500 }
    );
  }
}
