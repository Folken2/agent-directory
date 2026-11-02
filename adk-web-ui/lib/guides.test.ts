import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogAgent } from './agent-catalog.ts';
import {
  absolutizeLinks,
  guideHeadings,
  guideMarkdown,
  guideMarkdownPath,
  guidesForAgent,
  loadGuides,
  parseGuide,
} from './guides.ts';

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

describe('guideMarkdown', () => {
  const BASE = 'https://agentdirectory.folch.ai';

  it('makes root-relative links and anchors absolute, outside code fences only', () => {
    const md = [
      'See [Exa](/agents/exa_mcp_agent) and [below](#common-errors), [ADK](https://adk.dev/x).',
      '```markdown',
      '[keep](/relative)',
      '```',
      'And [contact](/contact).',
    ].join('\n');
    assert.equal(
      absolutizeLinks(md, BASE, '/guides/g'),
      [
        `See [Exa](${BASE}/agents/exa_mcp_agent) and [below](${BASE}/guides/g#common-errors), [ADK](https://adk.dev/x).`,
        '```markdown',
        '[keep](/relative)',
        '```',
        `And [contact](${BASE}/contact).`,
      ].join('\n')
    );
  });

  it('leaves protocol-relative links alone', () => {
    assert.equal(absolutizeLinks('[x](//cdn.test/a)', BASE, '/guides/g'), '[x](//cdn.test/a)');
  });

  it('starts with the title, description and source URL, then the body', () => {
    const md = guideMarkdown(parseGuide('thing', SOURCE), BASE, 'Ada');
    assert.ok(md.startsWith('# How to do a thing\n\n> Learn it.\n\n'));
    assert.ok(md.includes(`Source: ${BASE}/guides/thing`));
    assert.ok(md.includes('By Ada. Published 2026-11-02.'));
    assert.ok(md.includes('## Second step'));
    assert.ok(!md.includes('seoTitle'), 'frontmatter must not leak into the copy');
  });

  it('turns every link in the real guides absolute', () => {
    for (const guide of loadGuides()) {
      const md = guideMarkdown(guide, BASE, 'Ada');
      const outsideFences = md.split(/```[\s\S]*?```/).join('');
      assert.ok(!/\]\((\/|#)/.test(outsideFences), `${guide.slug} still has a relative link`);
      assert.equal(guideMarkdownPath(guide.slug), `/guides/${guide.slug}.md`);
    }
  });
});
