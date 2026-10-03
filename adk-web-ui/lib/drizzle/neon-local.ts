import { neonConfig } from '@neondatabase/serverless';

/**
 * Local development database (docker-compose.dev.yml at the repo root).
 *
 * The neon-http driver sends queries over HTTPS to Neon's SQL-over-HTTP
 * endpoint, which plain Postgres does not speak. When DATABASE_URL points at
 * the local dev host, queries go to the local-neon-http-proxy container
 * instead. Any other host (real Neon) keeps the driver's default endpoint.
 */
export const LOCAL_DB_HOST = 'db.localtest.me';
const LOCAL_PROXY_PORT = 4444;

export function configureLocalNeon(url: string | undefined = process.env.DATABASE_URL): boolean {
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  if (host !== LOCAL_DB_HOST) return false;
  neonConfig.fetchEndpoint = (h) => `http://${h}:${LOCAL_PROXY_PORT}/sql`;
  return true;
}

configureLocalNeon();
