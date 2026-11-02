import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogAgent } from './agent-catalog.ts';
import { guideHeadings, guidesForAgent, loadGuides, parseGuide } from './guides.ts';

const SOURCE = `---
title: How to do a thing
seoTitle: Do a thing: ADK
description: Learn it.
published: 2026-11-02
agents: a_agent, b_agent
keywords: ADK, MCP
---

Intro.

## First \`step\`

\`\`\`python
## not a heading
\`\`\`

## Second step
`;

describe('parseGuide', () => {
  it('reads frontmatter, keeping colons inside values', () => {
    const guide = parseGuide('thing', SOURCE);
    assert.equal(guide.seoTitle, 'Do a thing: ADK');
    assert.deepEqual(guide.agents, ['a_agent', 'b_agent']);
    assert.deepEqual(guide.keywords, ['ADK', 'MCP']);
    assert.equal(guide.updated, undefined);
    assert.ok(guide.body.startsWith('Intro.'));
  });

  it('rejects a guide without required fields or with a bad date', () => {
    assert.throws(() => parseGuide('x', 'no frontmatter'));
    assert.throws(() => parseGuide('x', SOURCE.replace('title: How to do a thing\n', '')), /title/);
    assert.throws(() => parseGuide('x', SOURCE.replace('2026-11-02', 'Nov 2')), /YYYY-MM-DD/);
  });

  it('lists ## headings outside code fences', () => {
    assert.deepEqual(guideHeadings(parseGuide('thing', SOURCE).body), [
      { id: 'first-step', text: 'First step' },
      { id: 'second-step', text: 'Second step' },
    ]);
  });
});

describe('content/guides', () => {
  const guides = loadGuides();

  it('has at least one guide, each with a short title and real example agents', () => {
    assert.ok(guides.length > 0);
    for (const guide of guides) {
      assert.ok(guide.seoTitle.length <= 60, `${guide.slug}: seoTitle is ${guide.seoTitle.length} chars`);
      assert.ok(guide.description.length <= 160, `${guide.slug}: description is ${guide.description.length} chars`);
      assert.ok(guide.agents.length > 0, `${guide.slug}: no example agents`);
      for (const name of guide.agents) assert.ok(getCatalogAgent(name), `${guide.slug}: unknown agent ${name}`);
    }
  });

  it('has unique heading ids within each guide', () => {
    for (const guide of guides) {
      const ids = guideHeadings(guide.body).map((heading) => heading.id);
      assert.equal(new Set(ids).size, ids.length, guide.slug);
    }
  });

  it('links the MCP agents back to the MCP guide', () => {
    for (const name of ['exa_mcp_agent', 'mermaid_mcp_agent', 'xquik_mcp_agent']) {
      assert.deepEqual(guidesForAgent(name, guides).map((guide) => guide.slug), ['adk-mcp-toolset']);
    }
  });
});
