import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { signToken } from '@/lib/jwt';
import { registerSchema } from '@/lib/validation';
import { consumeRateLimit, getRequestIdentity } from '@/server/shared/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identity = getRequestIdentity(request);
    const usernameKey =
      typeof body.username === 'string' ? body.username.toLowerCase().trim() : 'invalid';
    const rateLimit = await consumeRateLimit(`register:${identity}:${usernameKey}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Слишком много попыток регистрации' } },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Проверьте введённые данные', fieldErrors } },
        { status: 400 }
      );
    }

    const { username, password, name, timezone } = validation.data;
    const normalizedUsername = username.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (existing) {
      return NextResponse.json(
        { error: { code: 'USERNAME_TAKEN', message: 'Этот логин уже занят' } },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        name,
        passwordHash,
        timezone,
        locale: 'ru',
        defaultReminderTime: '09:00',
      },
    });

    const token = signToken({
      userId: user.id,
      username: user.username,
      sessionVersion: user.sessionVersion,
    });

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, name: user.name },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при регистрации' } },
      { status: 500 }
    );
  }
}
