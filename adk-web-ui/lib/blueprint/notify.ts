import type { SubmissionRecord } from './submission';
import { blueprintToMarkdown } from './markdown';

const TIMEOUT_MS = 5000;

/**
 * Tell the site owner about a saved blueprint by POSTing JSON to
 * BLUEPRINT_WEBHOOK_URL (any webhook: Slack/Zapier/email relay). The
 * optional BLUEPRINT_WEBHOOK_SECRET is sent as a bearer token. No-op when
 * unset. Throws on failure so the caller can record it.
 */
export async function notifyOwner(
  record: SubmissionRecord & { id: string },
  env: { url?: string; secret?: string } = {
    url: process.env.BLUEPRINT_WEBHOOK_URL,
    secret: process.env.BLUEPRINT_WEBHOOK_SECRET,
  },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!env.url) return;
  const res = await fetchImpl(env.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.secret ? { Authorization: `Bearer ${env.secret}` } : {}),
    },
    body: JSON.stringify({
      type: 'blueprint.saved',
      id: record.id,
      email: record.email,
      consentAt: record.consentAt.toISOString(),
      signedIn: record.userId !== null,
      blueprintName: record.blueprint.name,
      text: `New blueprint "${record.blueprint.name}" from ${record.email}`,
      markdown: blueprintToMarkdown(record.blueprint),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`webhook responded ${res.status}`);
}
