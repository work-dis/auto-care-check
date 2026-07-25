import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/jwt';
import { telegramAuthSchema } from '@/lib/validation';
import { verifyTelegramLoginWidget } from '@/integrations/telegram/loginWidget';
import { consumeRateLimit, getRequestIdentity } from '@/server/shared/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await consumeRateLimit(`telegram:${getRequestIdentity(request)}`, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Слишком много попыток входа' } },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }
    const body = await request.json();
    const validation = telegramAuthSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Отсутствуют данные Telegram', fieldErrors } },
        { status: 400 }
      );
    }

    const { initData } = validation.data;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: { code: 'SERVER_CONFIG', message: 'Telegram Bot Token не настроен' } },
        { status: 500 }
      );
    }

    // Validate the Telegram init data
    const telegramData = verifyTelegramLoginWidget(initData, botToken);
    if (!telegramData) {
      return NextResponse.json(
        { error: { code: 'INVALID_TELEGRAM_DATA', message: 'Недействительные данные Telegram' } },
        { status: 401 }
      );
    }

    const telegramId = telegramData.id;
    if (!telegramId) {
      return NextResponse.json(
        { error: { code: 'INVALID_TELEGRAM_DATA', message: 'Отсутствует ID пользователя Telegram' } },
        { status: 401 }
      );
    }

    const firstName = telegramData.first_name || '';
    const lastName = telegramData.last_name || '';
    const photoUrl = telegramData.photo_url || null;
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || `Telegram User ${telegramId}`;

    // Find or create user by telegramId
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      // Create new user with telegram login
      const username = `tg_${telegramId}`;

      // Check if username somehow already exists (collision edge case)
      const existingByUsername = await prisma.user.findUnique({ where: { username } });
      if (existingByUsername) {
        // Very unlikely, but handle gracefully
        return NextResponse.json(
          { error: { code: 'USERNAME_COLLISION', message: 'Конфликт при создании пользователя' } },
          { status: 409 }
        );
      }

      user = await prisma.user.create({
        data: {
          username,
          name,
          telegramId,
          telegramAvatarUrl: photoUrl,
        },
      });
    } else {
      // Update existing user's avatar if provided
      if (photoUrl && photoUrl !== user.telegramAvatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { telegramAvatarUrl: photoUrl, name: name || user.name },
        });
      }
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      sessionVersion: user.sessionVersion,
    });

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, name: user.name, telegramAvatarUrl: user.telegramAvatarUrl },
    });

    // Set JWT cookie (same as login route)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Telegram auth error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при входе через Telegram' } },
      { status: 500 }
    );
  }
}
