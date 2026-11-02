/**
 * Who may open `/analytics` and `/analytics/ops`.
 * Comma-separated emails in `ANALYTICS_OPS_EMAILS`. Unset or empty means
 * nobody: the dashboards fail closed rather than fall back to a baked-in owner.
 */
let warned = false;

export function analyticsOpsEmails(
  envValue: string | undefined = process.env.ANALYTICS_OPS_EMAILS
): string[] {
  const emails = (envValue ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
  if (emails.length === 0 && !warned && process.env.NODE_ENV === 'production') {
    warned = true;
    console.warn('[analytics] ANALYTICS_OPS_EMAILS is not set; /analytics is closed to everyone');
  }
  return emails;
}

export function isAnalyticsOpsEmail(
  email: string | null | undefined,
  envValue?: string
): boolean {
  if (!email) return false;
  return analyticsOpsEmails(envValue).includes(email.trim().toLowerCase());
}
