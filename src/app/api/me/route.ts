import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { userPreferencesSchema } from '@/lib/validation';

export async function GET() {
  try {
    const userId = await getSessionUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при получении профиля' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await request.json();

    const validation = userPreferencesSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Неверные параметры настроек', fieldErrors } },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        timezone: validation.data.timezone,
        defaultReminderTime: validation.data.defaultReminderTime,
        quietHoursStart: validation.data.quietHoursStart,
        quietHoursEnd: validation.data.quietHoursEnd,
      },
    });

    // Write AuditEvent
    await prisma.auditEvent.create({
      data: {
        userId,
        entityType: 'User',
        entityId: userId,
        action: 'UPDATE_PREFERENCES',
        afterJson: JSON.stringify(updatedUser),
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при обновлении настроек' } },
      { status: 500 }
    );
  }
}
