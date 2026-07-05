import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // On Vercel + Neon, use WebSocket-based adapter for serverless
  if (process.env.VERCEL === '1' || process.env.DATABASE_URL?.includes('neon.tech')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require('@neondatabase/serverless');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaNeon } = require('@prisma/adapter-neon');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaNeon(pool);
      return new PrismaClient({ adapter, log: ['error'] });
    } catch {
      console.warn('[Prisma] Neon adapter unavailable, using standard TCP');
    }
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}
