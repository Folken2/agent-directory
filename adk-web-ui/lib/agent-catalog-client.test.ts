import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findCatalogAgent, getCatalogAgent } from './agent-catalog-client.ts';

describe('agent-catalog-client', () => {
  it('returns the full chat metadata for a catalog agent', () => {
    const agent = findCatalogAgent('exa_mcp_agent');
    assert.ok(agent, 'expected exa_mcp_agent in the bundled snapshot');
    assert.ok(agent.displayName && agent.displayName !== 'exa_mcp_agent');
    assert.ok((agent.samplePrompts?.length ?? 0) > 0, 'chat empty state needs sample prompts');
    assert.match(agent.githubUrl ?? '', /\/tree\/main\/agents\/exa_mcp_agent$/);
  });

  it('returns null for an unknown slug so the chat can fall back to /api/agents', () => {
    assert.equal(findCatalogAgent('not_a_real_agent'), null);
    assert.equal(getCatalogAgent('not_a_real_agent').name, 'not_a_real_agent');
  });
});
