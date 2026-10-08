import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBuild } from './parse.ts';
import { BUILD } from './test-fixtures.ts';

describe('parseBuild', () => {
  it('accepts the state shape the backend writes', () => {
    assert.deepEqual(parseBuild(BUILD), BUILD);
  });

  it('fills defaults for optional fields', () => {
    const b = parseBuild({ name: 'x', package: 'x', artifact: 'x.zip', version: 2 });
    assert.ok(b);
    assert.equal(b.description, '');
    assert.deepEqual(b.options, {});
    assert.deepEqual(b.models, { fast: null, reasoning: null });
    assert.deepEqual([b.tools, b.skills, b.files, b.bytes, b.packagedAt], [[], [], 0, 0, '']);
  });

  it('rejects missing or unsafe required fields', () => {
    assert.equal(parseBuild(null), null);
    assert.equal(parseBuild('x'), null);
    assert.equal(parseBuild({ ...BUILD, name: '' }), null);
    assert.equal(parseBuild({ ...BUILD, package: undefined }), null);
    assert.equal(parseBuild({ ...BUILD, artifact: 'x.tar' }), null);
    assert.equal(parseBuild({ ...BUILD, artifact: '../x.zip' }), null);
    assert.equal(parseBuild({ ...BUILD, version: -1 }), null);
    assert.equal(parseBuild({ ...BUILD, version: 1.5 }), null);
  });

  it('caps lists and drops junk instead of failing', () => {
    const b = parseBuild({
      ...BUILD,
      tools: [...Array.from({ length: 60 }, (_, i) => `t${i}`), 7, null],
      skills: ['s'.repeat(80)],
      options: { with_slack: true, persona: 'yes', [`k${'x'.repeat(80)}`]: true },
      models: { fast: 42, reasoning: 'openrouter/x' },
      files: -3,
    });
    assert.ok(b);
    assert.equal(b.tools.length, 50);
    assert.equal(b.skills[0].length, 64);
    assert.deepEqual(b.options, { with_slack: true });
    assert.deepEqual(b.models, { fast: null, reasoning: 'openrouter/x' });
    assert.equal(b.files, 0);
  });
});
