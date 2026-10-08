import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adkClient } from './adk-client.ts';

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
