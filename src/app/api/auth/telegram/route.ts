import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/jwt';
import { telegramAuthSchema } from '@/lib/validation';
import crypto from 'crypto';

/**
 * Validate Telegram Login Widget initData using HMAC-SHA256.
 * See: https://core.telegram.org/widgets/login#checking-authorization
 */
function validateTelegramInitData(initData: string, botToken: string): Record<string, string> | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // Build data-check-string: all key=value sorted alphabetically, excluding hash
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') {
      pairs.push(`${key}=${value}`);
    }
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  // HMAC-SHA256: first derive secret key from bot token using SHA256("WebAppData"), then sign
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return null;

  // Return all validated params
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') {
      result[key] = value;
    }
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
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
    const telegramData = validateTelegramInitData(initData, botToken);
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
      const email = `tg_${telegramId}@autopulse.local`;

      // Check if email somehow already exists (collision edge case)
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        // Very unlikely, but handle gracefully
        return NextResponse.json(
          { error: { code: 'EMAIL_COLLISION', message: 'Конфликт при создании пользователя' } },
          { status: 409 }
        );
      }

      user = await prisma.user.create({
        data: {
          email,
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

    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, telegramAvatarUrl: user.telegramAvatarUrl },
      token,
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
