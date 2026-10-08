import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  artifactDownloadUrl,
  buildToMarkdown,
  enabledOptions,
  formatBytes,
  optionLabel,
  plural,
  runSteps,
  zipFileName,
} from './summary.ts';
import { BUILD } from './test-fixtures.ts';

describe('summary helpers', () => {
  it('labels options', () => {
    assert.equal(optionLabel('with_slack'), 'Slack');
    assert.equal(optionLabel('with_acp'), 'ACP');
    assert.equal(optionLabel('persona'), 'Persona');
    assert.deepEqual(enabledOptions(BUILD), ['Eval', 'Persona']);
  });

  it('formats sizes and counts', () => {
    assert.equal(formatBytes(900), '900 B');
    assert.equal(formatBytes(58213), '56.8 KB');
    assert.equal(formatBytes(10 * 1024 * 1024), '10 MB');
    assert.equal(plural(1, 'file'), '1 file');
    assert.equal(plural(41, 'file'), '41 files');
  });

  it('gives run steps that hold for every project', () => {
    const steps = runSteps('research-summarizer.zip');
    assert.equal(steps.length, 3);
    assert.match(steps[0], /research-summarizer\.zip/);
    assert.ok(steps.some((s) => s.includes('.env.example')));
    assert.ok(steps.some((s) => s.includes('README.md')));
  });

  it('renders Markdown for the owner', () => {
    const md = buildToMarkdown(BUILD);
    for (const s of ['# research-summarizer', 'Package: `research_summarizer`', 'Options: Eval, Persona', 'Tools: web_search', '41 files, 56.8 KB']) {
      assert.ok(md.includes(s), `missing ${s}`);
    }
    assert.ok(md.includes('reasoning default'));
  });

  it('makes a safe zip name', () => {
    assert.equal(zipFileName('research-summarizer'), 'research-summarizer.zip');
    assert.equal(zipFileName('../../etc'), 'etc.zip');
    assert.equal(zipFileName('"; rm'), 'rm.zip');
    assert.equal(zipFileName('///'), 'agent.zip');
  });

  it('builds the single-artifact URL', () => {
    const url = new URL(artifactDownloadUrl('adk_agent_builder', 'session-1', BUILD), 'http://x');
    assert.equal(url.pathname, '/api/artifacts');
    assert.equal(url.searchParams.get('app_name'), 'adk_agent_builder');
    assert.equal(url.searchParams.get('session_id'), 'session-1');
    assert.equal(url.searchParams.get('artifact_name'), 'research-summarizer.zip');
    assert.equal(url.searchParams.get('version'), '0');
  });
});
