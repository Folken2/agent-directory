import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adkPath,
  assertAppName,
  assertArtifactName,
  assertId,
  InvalidAdkSegmentError,
} from './adk-url.ts';

describe('assertAppName', () => {
  it('accepts python-module agent names', () => {
    assert.equal(assertAppName('adk_agent_builder'), 'adk_agent_builder');
    assert.equal(assertAppName('xquik_mcp_agent'), 'xquik_mcp_agent');
  });
  it('rejects traversal, separators, query chars and non-strings', () => {
    for (const bad of ['../list-apps', 'a/b', 'a?x=1', 'A_agent', '', '1agent', null, 42]) {
      assert.throws(() => assertAppName(bad), InvalidAdkSegmentError, String(bad));
    }
  });
});

describe('assertId', () => {
  it('accepts session ids and derived ADK user ids', () => {
    assert.equal(assertId('session-1712-abc'), 'session-1712-abc');
    assert.equal(assertId('u_3f1c2b9e-0000-4000-8000-000000000000', 'user_id'), 'u_3f1c2b9e-0000-4000-8000-000000000000');
    assert.equal(assertId('default-user', 'user_id'), 'default-user');
  });
  it('rejects dot segments, slashes, query chars and overlong values', () => {
    for (const bad of ['.', '..', 'a/b', 'a?b', 'a#b', 'x'.repeat(129), '', undefined]) {
      assert.throws(() => assertId(bad), InvalidAdkSegmentError, String(bad));
    }
  });
  it('reports the field name', () => {
    try {
      assertId('..', 'session_id');
      assert.fail('should throw');
    } catch (e) {
      assert.equal((e as InvalidAdkSegmentError).field, 'session_id');
    }
  });
});

describe('assertArtifactName', () => {
  it('accepts filenames with spaces and unicode', () => {
    assert.equal(assertArtifactName('generated image 1.png'), 'generated image 1.png');
    assert.equal(assertArtifactName('résumé.pdf'), 'résumé.pdf');
  });
  it('rejects separators, dot segments and control chars', () => {
    for (const bad of ['a/b.png', 'a\\b.png', '..', '.', 'bad\nname', '', 'x'.repeat(256)]) {
      assert.throws(() => assertArtifactName(bad), InvalidAdkSegmentError, JSON.stringify(bad));
    }
  });
});

describe('adkPath', () => {
  it('encodes every segment', () => {
    assert.equal(
      adkPath('apps', 'my_agent', 'users', 'u_1', 'sessions', 's 1', 'artifacts', 'a?b#c.png'),
      '/apps/my_agent/users/u_1/sessions/s%201/artifacts/a%3Fb%23c.png'
    );
  });
});
