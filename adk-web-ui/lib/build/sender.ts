import type { BuildLinkMessage } from './email';

export type ResendError = { message: string; name?: string };
/** The Resend SDK's return shape: it reports API errors here instead of throwing. */
export type ResendResult<T> = { data: T | null; error: ResendError | null };

/** The slice of the Resend SDK this feature uses (implemented in resend-client.ts). */
export type EmailClient = {
  sendEmail(
    payload: { from: string; to: string[]; subject: string; html: string; text: string; replyTo?: string },
    idempotencyKey: string,
  ): Promise<ResendResult<{ id: string }>>;
  createContact(email: string, segmentId: string): Promise<ResendResult<unknown>>;
  addContactToSegment(email: string, segmentId: string): Promise<ResendResult<unknown>>;
};

export type EmailSender = { client: EmailClient; from: string; replyTo: string | null };

export type SendOutcome = { kind: 'sent'; emailId: string | null } | { kind: 'dev' } | { kind: 'failed'; reason: string };

export type SendLinkArgs = { saveId: string; to: string; link: string; message: BuildLinkMessage };

type Log = Pick<Console, 'info' | 'warn' | 'error'>;

export function idempotencyKey(saveId: string): string {
  return `build-link/${saveId}`;
}

/** Email the link; with no sender configured (dev mode) log it instead. */
export async function sendBuildLink(sender: EmailSender | null, args: SendLinkArgs, log: Log = console): Promise<SendOutcome> {
  if (!sender) {
    log.info(`[builds] email is not configured (dev mode); link for save ${args.saveId}: ${args.link}`);
    return { kind: 'dev' };
  }
  try {
    const { data, error } = await sender.client.sendEmail(
      {
        from: sender.from,
        to: [args.to],
        subject: args.message.subject,
        html: args.message.html,
        text: args.message.text,
        ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
      },
      idempotencyKey(args.saveId),
    );
    if (error) {
      log.warn(`[builds] link email failed save=${args.saveId} error=${error.name ?? 'unknown'}`);
      return { kind: 'failed', reason: error.name ?? 'error' };
    }
    return { kind: 'sent', emailId: data?.id ?? null };
  } catch (e) {
    log.error(`[builds] link email threw save=${args.saveId} error=${e instanceof Error ? e.name : 'unknown'}`);
    return { kind: 'failed', reason: 'exception' };
  }
}

/** Opt-in to updates: add the contact to the segment. Never throws. */
export async function addUpdatesContact(
  client: EmailClient | null,
  email: string,
  segmentId: string | null,
  log: Log = console,
): Promise<'added' | 'skipped' | 'failed'> {
  if (!client || !segmentId) return 'skipped';
  try {
    const created = await client.createContact(email, segmentId);
    if (!created.error) return 'added';
    // Usually the contact exists already: add it to the segment instead.
    const added = await client.addContactToSegment(email, segmentId);
    if (!added.error) return 'added';
    log.warn(`[builds] could not add contact to segment error=${added.error.name ?? 'unknown'}`);
    return 'failed';
  } catch (e) {
    log.warn(`[builds] contact call threw error=${e instanceof Error ? e.name : 'unknown'}`);
    return 'failed';
  }
}
