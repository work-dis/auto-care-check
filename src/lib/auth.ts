import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { verifyToken } from './jwt';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const LEGACY_ACCOUNT_EMAILS = new Set(['owner@autopulse.local']);

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function isLegacyAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return LEGACY_ACCOUNT_EMAILS.has(email.toLowerCase());
}

/**
 * Get the current session user ID from JWT cookie.
 * The X-User-ID header remains available for isolated route tests.
 */
export async function getSessionUserId(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('auth_token')?.value;
    if (tokenCookie) {
      const payload = verifyToken(tokenCookie);
      return payload.userId;
    }
  } catch {
    // Fall through to explicit unauthorized handling below.
  }

  try {
    const headersList = await headers();
    const headerUserId = headersList.get('x-user-id');
    if (headerUserId && process.env.NODE_ENV === 'test') {
      return headerUserId;
    }
  } catch {
    // Ignore header lookup outside request context.
  }

  throw new UnauthorizedError();
}

/**
 * Require authenticated user. Returns user or throws.
 */
export async function requireUser() {
  const userId = await getSessionUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new UnauthorizedError();
  }
  if (isLegacyAccountEmail(user.email)) {
    await prisma.user.delete({
      where: { id: user.id },
    }).catch(() => {
      // Ignore cleanup race if the legacy user was already removed.
    });
    throw new UnauthorizedError();
  }
  return user;
}

export async function getCurrentUser() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}
