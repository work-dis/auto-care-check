import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export function getRequestIdentity(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function consumeRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
) {
  const now = Date.now();
  const resetAt = new Date(now + options.windowMs);
  const current = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;
  const bucket = current[0];
  if (Math.random() < 0.01) {
    void prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
    }).catch(() => undefined);
  }

  return {
    allowed: bucket.count <= options.limit,
    retryAfterSeconds:
      bucket.count <= options.limit
        ? 0
        : Math.max(1, Math.ceil((bucket.resetAt.getTime() - now) / 1000)),
  };
}
