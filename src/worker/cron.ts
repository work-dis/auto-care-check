import { checkAndGenerateNotifications } from '../lib/notificationEngine';
import { prisma } from '../lib/prisma';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000; // 10s

let isRunning = true;
let isProcessing = false;

async function runCycle(): Promise<void> {
  if (isProcessing) return; // skip if previous cycle still running
  isProcessing = true;
  const startTime = Date.now();
  try {
    const { createdCount } = await checkAndGenerateNotifications();
    const elapsed = Date.now() - startTime;
    if (createdCount > 0) {
      console.log(
        `[${new Date().toISOString()}] Created ${createdCount} notification(s) in ${elapsed}ms`
      );
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Notification check failed:`, err);
  } finally {
    isProcessing = false;
  }
}

function shutdown(): void {
  if (!isRunning) return;
  isRunning = false;
  console.log(`[${new Date().toISOString()}] Shutting down worker gracefully...`);
  const forceExitTimer = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Forced exit after timeout`);
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  // Wait for current cycle to finish, then disconnect and exit
  (async () => {
    while (isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await prisma.$disconnect();
    console.log(`[${new Date().toISOString()}] Worker stopped cleanly`);
    process.exit(0);
  })();
}

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] AutoPulse notification worker started`);
  console.log(`[${new Date().toISOString()}] Poll interval: ${POLL_INTERVAL_MS / 1000}s`);

  // Run first cycle immediately
  await runCycle();

  // Schedule subsequent cycles
  const intervalHandle = setInterval(() => {
    if (isRunning) {
      runCycle();
    }
  }, POLL_INTERVAL_MS);
  intervalHandle.unref();

  // Handle shutdown signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] Worker fatal error:`, err);
  prisma.$disconnect().finally(() => process.exit(1));
});
