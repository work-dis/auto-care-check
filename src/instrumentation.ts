export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;

  const required = ['DATABASE_URL', 'JWT_SECRET', 'DATA_ENCRYPTION_KEY', 'CRON_SECRET'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}
