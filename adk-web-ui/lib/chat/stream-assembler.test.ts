import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StreamAssembler } from './stream-assembler.ts';

describe('StreamAssembler', () => {
  it('assembles single-agent text and thinking', () => {
    const a = new StreamAssembler({ name: 'solo' });
    assert.deepEqual(a.apply({ type: 'thinking', content: 'hmm' }), { thinkingActive: true, thinking: 'hmm' });
    assert.deepEqual(a.apply({ type: 'thinking', content: 'hmm' }), { thinkingActive: true });
    assert.deepEqual(a.apply({ type: 'text', content: 'Hel' }), { thinkingActive: false, content: 'Hel' });
    assert.deepEqual(a.apply({ type: 'text', content: 'Hello' }), { thinkingActive: false, content: 'Hello' });
    assert.deepEqual(a.apply({ type: 'text', content: 'Hello' }), { thinkingActive: false });
    assert.deepEqual(a.apply({ type: 'done' }), { done: true });
    const msg = a.finalize();
    assert.equal(msg.content, 'Hello');
    assert.equal(msg.thinking, 'hmm');
    assert.equal(msg.subAgentSteps, undefined);
  });

  it('routes intermediate authors into steps and closes them when the final author speaks', () => {
    const a = new StreamAssembler({ name: 'root', finalSubAgent: 'writer' });
    const u1 = a.apply({ type: 'text', content: 'planning', author: 'planner' });
    assert.equal(u1.content, undefined);
    assert.equal(u1.subAgentSteps?.[0].status, 'running');
    const u2 = a.apply({ type: 'toolCall', author: 'planner', toolCall: { id: 't', name: 'search', args: {}, status: 'running' } });
    assert.equal(u2.toolCall, undefined);
    assert.equal(u2.toolCallName, 'search');
    const u3 = a.apply({ type: 'toolResponse', toolResponse: { id: 't', name: 'search', response: 1 } });
    assert.equal(u3.toolResponse, undefined);
    assert.equal(u3.subAgentSteps?.[0].tools?.[0].status, 'completed');
    const u4 = a.apply({ type: 'text', content: 'Report', author: 'writer' });
    assert.equal(u4.content, 'Report');
    assert.equal(u4.subAgentSteps?.[0].status, 'done');
    assert.equal(a.finalize().subAgentSteps?.length, 1);
  });

  it('passes main-author tool activity, artifacts and errors to the UI', () => {
    const a = new StreamAssembler({ name: 'solo' });
    const call = { id: 'c', name: 'gen', args: {}, status: 'running' as const };
    assert.deepEqual(a.apply({ type: 'toolCall', toolCall: call }), { toolCallName: 'gen', toolCall: call });
    const resp = { id: 'c', name: 'gen', response: 'ok' };
    assert.deepEqual(a.apply({ type: 'toolResponse', toolResponse: resp }), { toolResponse: resp });
    const artifact = { id: 'x', name: 'x.png', type: 'image' as const, url: '/x' };
    assert.deepEqual(a.apply({ type: 'artifact', artifact }), { artifact });
    assert.deepEqual(a.apply({ type: 'error', error: 'bad', code: 'rate_limited' }), {
      error: { message: 'bad', code: 'rate_limited' },
    });
  });

  it('keeps maps captures and can drop extras for partial messages', () => {
    const a = new StreamAssembler({ name: 'root', finalSubAgent: 'w' });
    a.apply({ type: 'mapsCapture', mapsCapture: { token: 't', places: [], captured_at: 'now' } });
    a.apply({ type: 'text', content: 'step', author: 'p' });
    a.apply({ type: 'text', content: 'final', author: 'w' });
    assert.equal(a.finalize().mapsCaptures?.length, 1);
    const partial = a.finalize({ includeExtras: false });
    assert.equal(partial.mapsCaptures, undefined);
    assert.equal(partial.subAgentSteps, undefined);
  });

  it('resolves a fenced guide document into lead content', () => {
    const a = new StreamAssembler({ name: 'solo' });
    const doc = {
      shape: 'single',
      lead: 'Lead text',
      places: [{ id: 'p1', name: 'Cafe' }],
      sections: [{ id: 's1', title: 'Where', placeIds: ['p1'] }],
    };
    a.apply({ type: 'text', content: 'Intro\n```guidejson\n' + JSON.stringify(doc) + '\n```' });
    const msg = a.finalize();
    assert.ok(msg.guideDocument, 'expected guide document from fence');
    assert.ok(!msg.content.includes('guidejson'));
  });

  it('keeps a streamed blueprint and falls back to the fence', () => {
    const bp = { name: 'Bp', goal: 'G', agents: [{ name: 'a', role: 'r', kind: 'llm' as const, tools: [], subAgents: [] }], tools: [], dataSources: [], models: [], risks: [], nextSteps: [] };
    const a = new StreamAssembler({ name: 'adk_agent_builder' });
    a.apply({ type: 'text', content: 'Design.' });
    assert.deepEqual(a.apply({ type: 'blueprint', blueprint: bp }), {});
    assert.equal(a.finalize().blueprint?.name, 'Bp');

    const b = new StreamAssembler({ name: 'adk_agent_builder' });
    b.apply({ type: 'text', content: 'Design.\n```blueprintjson\n' + JSON.stringify(bp) + '\n```' });
    const msg = b.finalize();
    assert.equal(msg.blueprint?.name, 'Bp');
    assert.equal(msg.content, 'Design.');
  });
});
