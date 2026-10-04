import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PREVIEW_TEXT, parsePreviewRun, parsePreviewState, previewError } from './types.ts';

describe('parsePreviewState', () => {
  it('keeps the fields the builder writes', () => {
    assert.deepEqual(
      parsePreviewState({ status: 'running', project: 'support-triage', package: 'support_triage', startedAt: 't' }),
      { status: 'running', project: 'support-triage', package: 'support_triage', startedAt: 't' },
    );
    assert.deepEqual(parsePreviewState({ status: 'stopped' }), {
      status: 'stopped', project: undefined, package: undefined, startedAt: undefined,
    });
  });

  it('rejects anything else', () => {
    assert.equal(parsePreviewState(null), null);
    assert.equal(parsePreviewState({ status: 'booting' }), null);
    assert.equal(parsePreviewState('running'), null);
  });
});

describe('parsePreviewRun', () => {
  it('accepts a session id and text', () => {
    assert.deepEqual(parsePreviewRun({ previewSessionId: 'a1-b2', text: 'hi' }), { previewSessionId: 'a1-b2', text: 'hi' });
  });

  it('rejects unsafe ids and empty or long text', () => {
    assert.ok('error' in parsePreviewRun({ previewSessionId: '../x', text: 'hi' }));
    assert.ok('error' in parsePreviewRun({ previewSessionId: 'a', text: '   ' }));
    assert.ok('error' in parsePreviewRun({ previewSessionId: 'a', text: 'x'.repeat(MAX_PREVIEW_TEXT + 1) }));
    assert.ok('error' in parsePreviewRun(null));
  });
});

describe('previewError', () => {
  it('turns proxy statuses into codes and plain messages', () => {
    assert.equal(previewError(404).code, 'not_found');
    assert.match(previewError(410).message, /start it again/);
    assert.equal(previewError(429).code, 'rate_limited');
    assert.equal(previewError(502).code, 'backend_unavailable');
  });
});
