import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notifyOwner } from './notify.ts';
import { BUILD } from './test-fixtures.ts';

const n = { id: 'save-1', email: 'delivered@resend.dev', signedIn: false, build: BUILD, updates: true, help: true };

describe('notifyOwner', () => {
  it('is a no-op without a webhook url', async () => {
    let called = false;
    const sent = await notifyOwner(n, {}, (async () => ((called = true), new Response())) as typeof fetch);
    assert.equal(sent, false);
    assert.equal(called, false);
  });

  it('posts build.saved with the bearer secret and throws on non-2xx', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const ok = (async (url: string, init: RequestInit) => (calls.push({ url, init }), new Response('ok'))) as unknown as typeof fetch;
    assert.equal(await notifyOwner(n, { url: 'https://hook.test/x', secret: 's3' }, ok), true);
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer s3');
    const payload = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(
      { type: payload.type, id: payload.id, email: payload.email, signedIn: payload.signedIn, projectName: payload.projectName, updates: payload.updates, help: payload.help },
      { type: 'build.saved', id: 'save-1', email: 'delivered@resend.dev', signedIn: false, projectName: 'research-summarizer', updates: true, help: true },
    );
    assert.ok(payload.markdown.includes('# research-summarizer'));

    const fail = (async () => new Response('no', { status: 500 })) as typeof fetch;
    await assert.rejects(notifyOwner(n, { url: 'https://hook.test/x' }, fail));
  });
});
