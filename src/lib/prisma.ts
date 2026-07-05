import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatabaseUrl(): string {
  // Vercel + Supabase auto-provisions POSTGRES_PRISMA_URL
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  return process.env.DATABASE_URL ?? 'postgresql://localhost:5432/autopulse';
}

function resolveDirectUrl(): string | undefined {
  if (process.env.POSTGRES_URL_NON_POOLING) return process.env.POSTGRES_URL_NON_POOLING;
  return process.env.DIRECT_URL ?? undefined;
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = resolveDatabaseUrl();
  const isNeon = databaseUrl.includes('neon.tech');

  // Neon — WebSocket-based adapter (works in serverless)
  if (isNeon && process.env.VERCEL === '1') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require('@neondatabase/serverless');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaNeon } = require('@prisma/adapter-neon');
      const pool = new Pool({ connectionString: databaseUrl });
      const adapter = new PrismaNeon(pool);
      return new PrismaClient({ adapter, log: ['error'] });
    } catch {
      console.warn('[Prisma] Neon adapter unavailable, using standard TCP');
    }
  }

  // Supabase / standard TCP — works out of the box
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// Map Supabase-provided env vars to Prisma's expected names.
// Vercel + Supabase auto-provisions POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING
// but Prisma schema expects DATABASE_URL / DIRECT_URL.
if (process.env.POSTGRES_PRISMA_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (process.env.POSTGRES_URL_NON_POOLING && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}
