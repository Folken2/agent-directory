import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractBlueprintFence, parseBlueprint, resolveBlueprintContent } from './parse.ts';
import { blueprintFileName, blueprintToMarkdown } from './markdown.ts';

const VALID = {
  name: 'Support triage',
  goal: 'Triage support emails and draft replies.',
  agents: [
    { name: 'root_agent', role: 'Routes emails', kind: 'sequential', subAgents: ['drafter'] },
    { name: 'drafter', role: 'Drafts replies', model: 'gemini-2.5-flash', tools: ['search_kb'] },
  ],
  tools: [{ name: 'search_kb', kind: 'function', purpose: 'Search the help center' }],
  dataSources: [{ name: 'Help center', purpose: 'Answers', access: 'REST' }],
  models: [{ model: 'gemini-2.5-flash', usedBy: ['drafter'], reason: 'Fast' }],
  risks: ['Wrong refunds'],
  nextSteps: ['Write search_kb', 'Add evals'],
  codeSkeleton: 'from google.adk.agents import LlmAgent',
};

describe('parseBlueprint', () => {
  it('accepts a valid document and fills defaults', () => {
    const bp = parseBlueprint(VALID);
    assert.ok(bp);
    assert.equal(bp.agents[1].kind, 'llm');
    assert.deepEqual(bp.agents[0].tools, []);
    assert.equal(parseBlueprint({ name: 'x', goal: 'y', agents: [{ name: 'a', role: 'r' }] })?.tools.length, 0);
  });

  it('rejects invalid shapes', () => {
    assert.equal(parseBlueprint(null), null);
    assert.equal(parseBlueprint({ ...VALID, agents: [] }), null);
    assert.equal(parseBlueprint({ ...VALID, agents: [{ name: 'a', role: 'r', kind: 'robot' }] }), null);
    assert.equal(parseBlueprint({ ...VALID, tools: [{ name: 't', kind: 'function' }] }), null);
    assert.equal(parseBlueprint({ ...VALID, name: 'x'.repeat(500) }), null);
    assert.equal(parseBlueprint({ ...VALID, risks: [1] }), null);
  });
});

describe('fence fallback', () => {
  const text = `Design below.\n\n\`\`\`blueprintjson\n${JSON.stringify(VALID)}\n\`\`\`\nThoughts?`;
  it('extracts and strips a valid fence', () => {
    const { blueprint, displayText } = extractBlueprintFence(text);
    assert.equal(blueprint?.name, 'Support triage');
    assert.ok(displayText.startsWith('Design below.') && displayText.endsWith('Thoughts?'));
    assert.ok(!displayText.includes('blueprintjson'));
  });
  it('keeps malformed fences visible', () => {
    const bad = '```blueprintjson\n{oops}\n```';
    assert.deepEqual(extractBlueprintFence(bad), { blueprint: null, displayText: bad });
  });
  it('prefers the state blueprint', () => {
    const fromState = parseBlueprint({ ...VALID, name: 'From state' });
    assert.equal(resolveBlueprintContent(text, fromState).blueprint?.name, 'From state');
    assert.equal(resolveBlueprintContent('plain').blueprint, undefined);
    assert.equal(resolveBlueprintContent('plain').content, 'plain');
  });
});

describe('markdown export', () => {
  it('renders every section', () => {
    const md = blueprintToMarkdown(parseBlueprint(VALID)!);
    for (const s of ['# Support triage', '## Agents', '### root_agent (sequential)', '## Tools', '## Data sources', '## Models', '## Risks', '## Next steps', '2. Add evals', '```python']) {
      assert.ok(md.includes(s), `missing ${s}`);
    }
  });
  it('makes a safe file name', () => {
    assert.equal(blueprintFileName(parseBlueprint(VALID)!), 'support-triage-blueprint.md');
    assert.equal(blueprintFileName({ ...parseBlueprint(VALID)!, name: '../..' }), 'agent-blueprint.md');
  });
});
