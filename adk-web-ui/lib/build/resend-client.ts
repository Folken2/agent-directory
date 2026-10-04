import { Resend } from 'resend';
import type { EmailClient } from './sender';

/** Server only: the Resend API has no CORS on purpose, and the key is secret. */
export function resendEmailClient(apiKey: string): EmailClient {
  const resend = new Resend(apiKey);
  return {
    sendEmail: (payload, idempotencyKey) => resend.emails.send(payload, { idempotencyKey }),
    createContact: (email, segmentId) =>
      resend.contacts.create({ email, unsubscribed: false, segments: [{ id: segmentId }] }),
    addContactToSegment: (email, segmentId) => resend.contacts.segments.add({ email, segmentId }),
  };
}
