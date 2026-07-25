import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      database: 'reachable',
      durationMs: Date.now() - startedAt,
      features: {
        pushConfigured: Boolean(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
        ),
        emailConfigured: Boolean(
          process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
        ),
        telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        uploadsConfigured: Boolean(
          process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET,
        ),
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: 'unavailable',
        database: 'unreachable',
        durationMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
