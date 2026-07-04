import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUnauthorizedError, requireUser } from '@/lib/auth';
import { userPreferencesSchema } from '@/lib/validation';

function serializeUser(user: {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  defaultReminderTime: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    defaultReminderTime: user.defaultReminderTime,
    quietHoursStart: user.quietHoursStart,
    quietHoursEnd: user.quietHoursEnd,
  };
}

export async function GET() {
  try {
    const user = await requireUser();

    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
        { status: 401 }
      );
    }

    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при получении профиля' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
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
      where: { id: user.id },
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
        userId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'UPDATE_PREFERENCES',
        afterJson: JSON.stringify(updatedUser),
      },
    });

    return NextResponse.json({ user: serializeUser(updatedUser) });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
        { status: 401 }
      );
    }

    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при обновлении настроек' } },
      { status: 500 }
    );
  }
}
