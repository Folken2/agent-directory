import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SubAgentTracker, isIntermediateAuthor } from './sub-agent-steps.ts';

const agent = { name: 'root', finalSubAgent: 'writer' };

describe('isIntermediateAuthor', () => {
  it('only applies to agents with a finalSubAgent', () => {
    assert.equal(isIntermediateAuthor(agent, 'planner'), true);
    assert.equal(isIntermediateAuthor(agent, 'writer'), false);
    assert.equal(isIntermediateAuthor(agent, 'root'), false);
    assert.equal(isIntermediateAuthor(agent, undefined), false);
    assert.equal(isIntermediateAuthor({ name: 'root' }, 'planner'), false);
  });
});

describe('SubAgentTracker', () => {
  it('closes the previous step on author change and numbers re-runs', () => {
    let t = 0;
    const tracker = new SubAgentTracker(() => ++t);
    tracker.recordText('planner', 'plan');
    tracker.recordText('searcher', 'found');
    tracker.recordText('planner', 'again');
    const steps = tracker.snapshot();
    assert.deepEqual(steps.map((s) => [s.author, s.status, s.runIndex]), [
      ['planner', 'done', 1],
      ['searcher', 'done', 1],
      ['planner', 'running', 2],
    ]);
    assert.ok(steps[0].completedAt);
  });

  it('dedupes text and reports unchanged writes', () => {
    const tracker = new SubAgentTracker();
    assert.equal(tracker.recordText('a', 'hello'), true);
    assert.equal(tracker.recordText('a', 'hello'), false);
    assert.equal(tracker.recordText('a', 'hello there'), true);
    assert.equal(tracker.snapshot()[0].content, 'hello there');
  });

  it('nests tool calls and responses', () => {
    const tracker = new SubAgentTracker();
    tracker.recordToolCall('a', { id: 't1', name: 'search', status: 'running' });
    assert.equal(tracker.hasTool('t1'), true);
    assert.equal(tracker.recordToolResponse({ id: 't1', response: { ok: 1 } }), true);
    assert.equal(tracker.recordToolResponse({ id: 'missing', response: null }), false);
    const tool = tracker.snapshot()[0].tools![0];
    assert.equal(tool.status, 'completed');
    tracker.recordToolCall('a', { id: 't2', name: 'fetch', status: 'pending' });
    tracker.recordToolResponse({ id: 't2', response: null, error: 'nope' });
    assert.equal(tracker.snapshot()[0].tools![1].status, 'error');
  });

  it('snapshots are independent copies', () => {
    const tracker = new SubAgentTracker();
    tracker.recordToolCall('a', { id: 't1', name: 'x', status: 'running' });
    const snap = tracker.snapshot();
    tracker.recordToolResponse({ id: 't1', response: 1 });
    assert.equal(snap[0].tools![0].status, 'running');
  });

  it('closeRunning reports whether anything changed', () => {
    const tracker = new SubAgentTracker();
    assert.equal(tracker.closeRunning(), false);
    tracker.recordThinking('a', 'hmm');
    assert.equal(tracker.closeRunning(), true);
    assert.equal(tracker.closeRunning(), false);
  });
});
