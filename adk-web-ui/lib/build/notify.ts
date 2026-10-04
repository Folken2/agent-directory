import type { Build } from './types';
import { buildToMarkdown } from './summary';

const TIMEOUT_MS = 5000;

export type OwnerNotification = {
  id: string;
  email: string;
  signedIn: boolean;
  build: Build;
  updates: boolean;
  help: boolean;
};

/**
 * Tell the site owner about an emailed build by POSTing JSON to the
 * configured webhook (any Slack/Zapier/email relay); the optional secret is
 * sent as a bearer token. Returns false when no webhook is configured;
 * throws on failure so the caller can record it.
 */
export async function notifyOwner(
  n: OwnerNotification,
  env: { url?: string; secret?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.url) return false;
  const res = await fetchImpl(env.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.secret ? { Authorization: `Bearer ${env.secret}` } : {}),
    },
    body: JSON.stringify({
      type: 'build.saved',
      id: n.id,
      email: n.email,
      signedIn: n.signedIn,
      projectName: n.build.name,
      updates: n.updates,
      help: n.help,
      // Slack-style relays need a text field.
      text: `New build "${n.build.name}" emailed to ${n.email}${n.help ? ' (asked for help deploying)' : ''}`,
      markdown: buildToMarkdown(n.build),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`webhook responded ${res.status}`);
  return true;
}
