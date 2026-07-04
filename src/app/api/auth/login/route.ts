import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isLegacyAccountEmail, verifyPassword } from '@/lib/auth';
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

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && isLegacyAccountEmail(user.email)) {
      await prisma.user.delete({
        where: { id: user.id },
      }).catch(() => {
        // Ignore cleanup race if the legacy user was already removed.
      });
    }
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль' } },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль' } },
        { status: 401 }
      );
    }

    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });

    // Set JWT cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
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
