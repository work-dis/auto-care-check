import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export function proxy(request: NextRequest) {
  // Skip middleware for static assets or images
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const userId = request.cookies.get('auth_user_id')?.value;
  const demoUserId = process.env.DEMO_USER_ID || DEFAULT_DEMO_USER_ID;

  // If cookie is not present, set it to the default demo user ID and reload or continue
  if (!userId) {
    const response = NextResponse.next();
    response.cookies.set('auth_user_id', demoUserId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
