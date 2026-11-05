import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adkClient } from './adk-client.ts';
import { friendlyMessage } from './api-error.ts';

// extractFunctionCalls is private; the test reaches it through a cast.
const extract = (event: unknown) =>
  (adkClient as unknown as { extractFunctionCalls(e: unknown): Array<{ id: string; name: string; args: unknown }> })
    .extractFunctionCalls(event);

describe('adk-client function calls', () => {
  it('reads the complete call from a final event', () => {
    const calls = extract({
      content: { parts: [{ functionCall: { id: 'c1', name: 'scaffold_agent', args: { name: 'x' } } }] },
    });
    assert.deepEqual(
      calls.map(({ id, name, args }) => ({ id, name, args })),
      [{ id: 'c1', name: 'scaffold_agent', args: { name: 'x' } }],
    );
  });

  it('ignores the argument fragments google-adk 2.x streams before it', () => {
    const fragment = {
      partial: true,
      content: { parts: [{ functionCall: { id: 'c1', name: 'scaffold_agent', willContinue: true, partialArgs: [] } }] },
    };
    assert.deepEqual(extract(fragment), []);
  });
});

describe('adk-client preview stream', () => {
  it('posts to /api/preview and surfaces text and preview state', async () => {
    const events = [
      { author: 'support_triage', content: { parts: [{ text: 'Hi there' }] } },
      { author: 'adk_agent_builder', actions: { stateDelta: { 'builder:preview': { status: 'running', package: 'p' } } } },
    ];
    const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }) as typeof fetch;
    try {
      const chunks = [];
      for await (const chunk of adkClient.streamPreview('session-abc', 'p-1', 'Hello')) chunks.push(chunk);
      assert.equal(calls[0].url, '/api/preview?session_id=session-abc');
      assert.deepEqual(JSON.parse(String(calls[0].init.body)), { previewSessionId: 'p-1', text: 'Hello' });
      assert.ok(chunks.some((c) => c.type === 'text' && c.content === 'Hi there'));
      const preview = chunks.find((c) => c.type === 'preview');
      assert.deepEqual(preview && preview.type === 'preview' ? preview.preview.status : null, 'running');
      assert.equal(chunks.at(-1)?.type, 'done');
    } finally {
      globalThis.fetch = original;
    }
  });
});


describe('adk-client build state', () => {
  it('yields a parsed builder:build from the state delta', async () => {
    const build = {
      name: 'research-summarizer',
      package: 'research_summarizer',
      artifact: 'research-summarizer.zip',
      version: 0,
      files: 41,
      bytes: 58213,
    };
    const events = [
      { author: 'adk_agent_builder', actions: { stateDelta: { 'builder:build': build } } },
      { author: 'adk_agent_builder', actions: { state_delta: { 'builder:build': { name: 'bad' } } } },
    ];
    const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })) as typeof fetch;
    try {
      const chunks = [];
      for await (const chunk of adkClient.streamPreview('session-abc', 'p-1', 'Hello')) chunks.push(chunk);
      const builds = chunks.filter((c) => c.type === 'build');
      assert.equal(builds.length, 1);
      assert.equal(builds[0].type === 'build' ? builds[0].build.artifact : null, 'research-summarizer.zip');
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('adk-client failed runs', () => {
  // Response captured from the live site on 2026-11-05 (HTTP 200, run failed).
  const providerError = 'ClientError: 402 Payment Required. Your prepaid credits are depleted.';
  const camelCaseEvent = {
    author: 'data_analyst_agent',
    errorCode: 'Payment Required',
    errorMessage: 'Your prepaid credits are depleted.',
  };
  const exceptionFrame = {
    error: providerError,
    error_details: { error_type: 'ClientError', error_message: providerError, timestamp: 1 },
  };

  const run = async (events: unknown[]) => {
    const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })) as typeof fetch;
    try {
      const chunks = [];
      for await (const chunk of adkClient.streamAgent('data_analyst_agent', 'Hi', 'session-abc')) chunks.push(chunk);
      return chunks;
    } finally {
      globalThis.fetch = original;
    }
  };

  const friendly = { type: 'error', error: friendlyMessage('internal'), code: 'internal' };

  it('surfaces a camelCase errorCode event without its provider text', async () => {
    const chunks = await run([camelCaseEvent]);
    assert.deepEqual(chunks[0], friendly);
  });

  it('surfaces an {"error": ...} frame without its provider text', async () => {
    const chunks = await run([exceptionFrame]);
    assert.deepEqual(chunks[0], friendly);
  });

  it('never leaks provider or billing text when both arrive together', async () => {
    const chunks = await run([camelCaseEvent, exceptionFrame]);
    assert.ok(chunks.some((c) => c.type === 'error'));
    assert.doesNotMatch(JSON.stringify(chunks), /402|Payment|credits|ClientError/);
  });

  it("keeps the app's own guard frames and their friendly copy", async () => {
    const chunks = await run([{ error_code: 'idle_timeout', error: friendlyMessage('idle_timeout') }]);
    assert.deepEqual(chunks[0], { type: 'error', error: friendlyMessage('idle_timeout'), code: 'idle_timeout' });
  });

  it('shows the reply when errorCode is only a finish reason on an event with content', async () => {
    const chunks = await run([
      { author: 'data_analyst_agent', errorCode: 'MAX_TOKENS', content: { parts: [{ text: 'Cut off here' }] } },
    ]);
    assert.ok(chunks.some((c) => c.type === 'text' && c.content === 'Cut off here'));
    assert.ok(!chunks.some((c) => c.type === 'error'));
  });
});
