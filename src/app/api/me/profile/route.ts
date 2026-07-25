import { NextRequest, NextResponse } from 'next/server';
import { requireUser, hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { passwordChangeSchema, userProfileSchema } from '@/lib/validation';
import { apiErrorResponse, ApiError } from '@/server/shared/apiError';
import { signToken } from '@/lib/jwt';

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    if (body.action === 'password') {
      const data = passwordChangeSchema.parse(body);
      if (!user.passwordHash || !(await verifyPassword(data.currentPassword, user.passwordHash))) {
        throw new ApiError(400, 'INVALID_PASSWORD', 'Текущий пароль указан неверно');
      }
      const passwordHash = await hashPassword(data.newPassword);
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
        },
        select: { id: true, username: true, sessionVersion: true },
      });
      const response = NextResponse.json({ ok: true });
      response.cookies.set(
        'auth_token',
        signToken({
          userId: updated.id,
          username: updated.username,
          sessionVersion: updated.sessionVersion,
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        },
      );
      return response;
    }

    const data = userProfileSchema.parse(body);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        email: data.email || null,
        emailVerifiedAt: data.email === user.email ? user.emailVerifiedAt : null,
      },
      select: { name: true, email: true },
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось обновить профиль');
  }
}
