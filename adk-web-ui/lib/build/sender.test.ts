import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addUpdatesContact, idempotencyKey, sendBuildLink, type EmailClient } from './sender.ts';

const quiet = { info() {}, warn() {}, error() {} };
const args = {
  saveId: 'save-1',
  to: 'delivered@resend.dev',
  link: 'https://site.test/builds/tok',
  message: { subject: 'Your agent: x', html: '<p>x</p>', text: 'x' },
};

function client(over: Partial<EmailClient> = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const c: EmailClient = {
    async sendEmail(...a) {
      calls.push({ method: 'sendEmail', args: a });
      return { data: { id: 'em_1' }, error: null };
    },
    async createContact(...a) {
      calls.push({ method: 'createContact', args: a });
      return { data: { id: 'c_1' }, error: null };
    },
    async addContactToSegment(...a) {
      calls.push({ method: 'addContactToSegment', args: a });
      return { data: { id: 'c_1' }, error: null };
    },
    ...over,
  };
  return { c, calls };
}

describe('sendBuildLink', () => {
  it('sends with the build-link/<save id> idempotency key', async () => {
    const { c, calls } = client();
    const out = await sendBuildLink({ client: c, from: 'Builds <b@site.test>', replyTo: 'r@site.test' }, args, quiet);
    assert.deepEqual(out, { kind: 'sent', emailId: 'em_1' });
    assert.equal(idempotencyKey('save-1'), 'build-link/save-1');
    const [payload, key] = calls[0].args as [Record<string, unknown>, string];
    assert.equal(key, 'build-link/save-1');
    assert.deepEqual(payload, {
      from: 'Builds <b@site.test>',
      to: ['delivered@resend.dev'],
      subject: 'Your agent: x',
      html: '<p>x</p>',
      text: 'x',
      replyTo: 'r@site.test',
    });
  });

  it('treats a returned {error} as a failure (the SDK does not throw)', async () => {
    const { c } = client({ sendEmail: async () => ({ data: null, error: { message: 'domain not verified', name: 'validation_error' } }) });
    assert.deepEqual(await sendBuildLink({ client: c, from: 'b@site.test', replyTo: null }, args, quiet), {
      kind: 'failed',
      reason: 'validation_error',
    });
  });

  it('also survives a thrown network error', async () => {
    const { c } = client({ sendEmail: async () => { throw new TypeError('fetch failed'); } });
    assert.deepEqual(await sendBuildLink({ client: c, from: 'b@site.test', replyTo: null }, args, quiet), { kind: 'failed', reason: 'exception' });
  });

  it('logs the link instead of sending in dev mode', async () => {
    const lines: string[] = [];
    const out = await sendBuildLink(null, args, { ...quiet, info: (l: string) => void lines.push(l) });
    assert.deepEqual(out, { kind: 'dev' });
    assert.ok(lines[0].includes(args.link));
    assert.ok(!lines[0].includes(args.to));
  });
});

describe('addUpdatesContact', () => {
  it('skips without a client or a segment', async () => {
    const { c, calls } = client();
    assert.equal(await addUpdatesContact(null, 'a@b.test', 'seg_1', quiet), 'skipped');
    assert.equal(await addUpdatesContact(c, 'a@b.test', null, quiet), 'skipped');
    assert.equal(calls.length, 0);
  });

  it('creates the contact in the segment', async () => {
    const { c, calls } = client();
    assert.equal(await addUpdatesContact(c, 'a@b.test', 'seg_1', quiet), 'added');
    assert.deepEqual(calls.map((x) => [x.method, ...x.args]), [['createContact', 'a@b.test', 'seg_1']]);
  });

  it('adds an existing contact to the segment, and never throws', async () => {
    const exists = { data: null, error: { message: 'exists', name: 'validation_error' } };
    const { c, calls } = client({ createContact: async () => exists });
    assert.equal(await addUpdatesContact(c, 'a@b.test', 'seg_1', quiet), 'added');
    assert.equal(calls.at(-1)?.method, 'addContactToSegment');

    const { c: broken } = client({ createContact: async () => exists, addContactToSegment: async () => exists });
    assert.equal(await addUpdatesContact(broken, 'a@b.test', 'seg_1', quiet), 'failed');
    const { c: throwing } = client({ createContact: async () => { throw new Error('x'); } });
    assert.equal(await addUpdatesContact(throwing, 'a@b.test', 'seg_1', quiet), 'failed');
  });
});
