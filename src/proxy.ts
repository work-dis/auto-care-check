import { NextRequest, NextResponse } from 'next/server';

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

  const hasSession = Boolean(request.cookies.get('auth_token')?.value);

  if (PUBLIC_PAGE_ROUTES.has(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
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
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
