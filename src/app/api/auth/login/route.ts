import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { signToken } from '@/lib/jwt';
import { loginSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

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

    const { username, password } = validation.data;
    const normalizedUsername = username.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (!user) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' } },
        { status: 401 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: { code: 'NO_PASSWORD', message: 'Войдите через Telegram или установите пароль' } },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' } },
        { status: 401 }
      );
    }

    const token = signToken({ userId: user.id, username: user.username });

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, name: user.name },
      token,
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
    console.error('Login error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при входе' } },
      { status: 500 }
    );
  }
}
