/**
 * Who may open `/analytics/ops`.
 * Comma-separated emails in `ANALYTICS_OPS_EMAILS` (default: folkenai21@gmail.com).
 */
const DEFAULT_OPS_EMAILS = 'folkenai21@gmail.com';

export function analyticsOpsEmails(
  envValue: string | undefined = process.env.ANALYTICS_OPS_EMAILS
): string[] {
  const raw = (envValue?.trim() ? envValue : DEFAULT_OPS_EMAILS).trim();
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAnalyticsOpsEmail(
  email: string | null | undefined,
  envValue?: string
): boolean {
  if (!email) return false;
  return analyticsOpsEmails(envValue).includes(email.trim().toLowerCase());
}
