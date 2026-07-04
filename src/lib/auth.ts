import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';

const DEFAULT_DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function getSessionUserId(): Promise<string> {
  try {
    // 1. Check header x-user-id (useful for API routes and testing)
    const headersList = await headers();
    const headerUserId = headersList.get('x-user-id');
    if (headerUserId) {
      return headerUserId;
    }

    // 2. Check cookie (useful for browser/UI)
    const cookieStore = await cookies();
    const cookieUserId = cookieStore.get('auth_user_id')?.value;
    if (cookieUserId) {
      return cookieUserId;
    }
  } catch {
    // cookies() or headers() might throw if called outside request context (e.g. in some build stages or static pages)
    // We fall back silently in that case
  }

  // 3. Fallback to env variable or default demo user ID
  return process.env.DEMO_USER_ID || DEFAULT_DEMO_USER_ID;
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
