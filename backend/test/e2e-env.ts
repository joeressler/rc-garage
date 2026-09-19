import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const HOST_PG_PORT = process.env.E2E_PG_PORT || '55432';

/**
 * Purpose: hydrate process.env from workspace .env files without printing secrets.
 */
function loadRootEnv(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) {
      continue;
    }
    const text = readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const assignment = trimmed.startsWith('export ')
        ? trimmed.slice('export '.length).trim()
        : trimmed;
      const eq = assignment.indexOf('=');
      if (eq <= 0) {
        continue;
      }
      const key = assignment.slice(0, eq).trim();
      let value = assignment.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    return;
  }
}

/**
 * Purpose: host e2e cannot resolve compose hostname rc-db; point at the loopback socat proxy.
 */
function remapDatabaseUrlForHostE2e(): void {
  const user = process.env.POSTGRES_USER || 'rc_garage_admin';
  const password = process.env.POSTGRES_PASSWORD;
  const db = process.env.POSTGRES_DB || 'rc_garage_prod';
  const existing = process.env.DATABASE_URL ?? '';
  const needsHostProxy =
    !existing ||
    existing.includes('@rc-db:') ||
    /@(localhost|127\.0\.0\.1):5432\b/.test(existing);
  if (!needsHostProxy || !password) {
    return;
  }
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${HOST_PG_PORT}/${encodeURIComponent(db)}?schema=public`;
}

/**
 * Purpose: disable Nest IP throttles and skip live reCAPTCHA during local e2e bursts.
 */
export function applyE2eHardeningEnv(): void {
  loadRootEnv();
  remapDatabaseUrlForHostE2e();
  process.env.NODE_ENV = 'test';
  process.env.THROTTLE_DISABLED = 'true';
  process.env.RECAPTCHA_SECRET_KEY = 'dev-bypass';
}
