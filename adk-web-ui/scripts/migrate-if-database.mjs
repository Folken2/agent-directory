/**
 * Run drizzle-kit migrate when DATABASE_URL is a real connection.
 * Used in `npm run build` so Vercel deploys apply schema (e.g. page_views).
 * Skips quietly for local builds with placeholder / missing env.
 */
import { spawnSync } from 'node:child_process';

function hasRealDatabaseUrl(url) {
  if (!url) return false;
  if (/@host(?::|\/|\?|$)/i.test(url) || url.includes('user:password@')) return false;
  return true;
}

const url = process.env.DATABASE_URL;
if (!hasRealDatabaseUrl(url)) {
  console.log('[migrate-if-database] Skipping migrate (no real DATABASE_URL).');
  process.exit(0);
}

console.log('[migrate-if-database] Running drizzle-kit migrate…');
const result = spawnSync(
  'npx',
  ['drizzle-kit', 'migrate'],
  { stdio: 'inherit', env: process.env, shell: true }
);

if (result.status !== 0) {
  console.error('[migrate-if-database] Migrate failed.');
  process.exit(result.status ?? 1);
}

console.log('[migrate-if-database] Migrate complete.');
