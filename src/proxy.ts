import { NextRequest, NextResponse } from 'next/server';
import { isLegacyAccountEmail } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';

const PUBLIC_PAGE_ROUTES = new Set(['/login', '/register']);
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/register', '/api/auth/logout'];

function isPublicApiRoute(pathname: string) {
  return PUBLIC_API_PREFIXES.some((route) => pathname.startsWith(route));
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;
  let hasSession = false;

  if (token) {
    try {
      const payload = verifyToken(token);
      hasSession = !isLegacyAccountEmail(payload.email);
    } catch {
      hasSession = false;
    }
  }

  if (PUBLIC_PAGE_ROUTES.has(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (token) {
      const response = NextResponse.next();
      response.cookies.delete('auth_token');
      response.cookies.delete('auth_user_id');
      return response;
    }

    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    if (isPublicApiRoute(pathname) || hasSession) {
      return NextResponse.next();
    }

    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Требуется авторизация',
        },
      },
      { status: 401 }
    );
  }

  if (pathname === '/') {
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', `${pathname}${search}`);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.delete('auth_token');
      response.cookies.delete('auth_user_id');
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
