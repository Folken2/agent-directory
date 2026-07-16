/** True when DATABASE_URL looks like a real Postgres connection. */
export function isAnalyticsDbAvailable(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  if (/@host(?::|\/|\?|$)/i.test(url) || url.includes('user:password@')) return false;
  return true;
}
