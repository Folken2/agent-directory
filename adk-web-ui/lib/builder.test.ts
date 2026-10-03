import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDER_AGENT,
  BUILDER_EXAMPLE_PROMPTS,
  MAX_BUILDER_PROMPT_LENGTH,
  builderChatHref,
  exampleAgents,
  resolveChatAgentName,
} from './builder.ts';

describe('builderChatHref', () => {
  it('targets the builder agent with the trimmed prompt and auto-send flag', () => {
    const href = builderChatHref('  Build a travel planner  ');
    const url = new URL(href, 'http://x');
    assert.equal(url.pathname, '/chat');
    assert.equal(url.searchParams.get('agent'), BUILDER_AGENT);
    assert.equal(url.searchParams.get('prompt'), 'Build a travel planner');
    assert.equal(url.searchParams.get('send'), '1');
  });

  it('omits prompt and send for an empty prompt', () => {
    const url = new URL(builderChatHref('   '), 'http://x');
    assert.equal(url.searchParams.get('agent'), BUILDER_AGENT);
    assert.equal(url.searchParams.has('prompt'), false);
    assert.equal(url.searchParams.has('send'), false);
  });

  it('can prefill without auto-send', () => {
    const url = new URL(builderChatHref('hi', { autoSend: false }), 'http://x');
    assert.equal(url.searchParams.get('prompt'), 'hi');
    assert.equal(url.searchParams.has('send'), false);
  });

  it('caps very long prompts', () => {
    const url = new URL(builderChatHref('a'.repeat(MAX_BUILDER_PROMPT_LENGTH + 50)), 'http://x');
    assert.equal(url.searchParams.get('prompt')?.length, MAX_BUILDER_PROMPT_LENGTH);
  });
});

describe('resolveChatAgentName', () => {
  it('defaults to the builder when no agent is given', () => {
    assert.equal(resolveChatAgentName(null), BUILDER_AGENT);
    assert.equal(resolveChatAgentName(''), BUILDER_AGENT);
    assert.equal(resolveChatAgentName('   '), BUILDER_AGENT);
  });

  it('keeps an explicit agent', () => {
    assert.equal(resolveChatAgentName('deep_research_agent'), 'deep_research_agent');
  });
});

describe('exampleAgents', () => {
  it('drops the builder from the examples list and keeps order', () => {
    const list = [{ name: 'a' }, { name: BUILDER_AGENT }, { name: 'b' }];
    assert.deepEqual(exampleAgents(list).map((a) => a.name), ['a', 'b']);
  });
});

describe('BUILDER_EXAMPLE_PROMPTS', () => {
  it('has 3-4 short, distinct prompts', () => {
    assert.ok(BUILDER_EXAMPLE_PROMPTS.length >= 3 && BUILDER_EXAMPLE_PROMPTS.length <= 4);
    assert.equal(new Set(BUILDER_EXAMPLE_PROMPTS.map((p) => p.prompt)).size, BUILDER_EXAMPLE_PROMPTS.length);
    for (const p of BUILDER_EXAMPLE_PROMPTS) {
      assert.ok(p.label.length > 0 && p.label.length <= 40, p.label);
      assert.ok(p.prompt.length > 0 && p.prompt.length <= MAX_BUILDER_PROMPT_LENGTH);
    }
  });
});
