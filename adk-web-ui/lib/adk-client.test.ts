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
