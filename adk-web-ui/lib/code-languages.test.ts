import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLanguage, REGISTERED_LANGUAGES } from './code-languages';

test('maps common aliases to registered ids', () => {
  assert.equal(normalizeLanguage('py'), 'python');
  assert.equal(normalizeLanguage('Python'), 'python');
  assert.equal(normalizeLanguage('ts'), 'typescript');
  assert.equal(normalizeLanguage('tsx'), 'tsx');
  assert.equal(normalizeLanguage('js'), 'javascript');
  assert.equal(normalizeLanguage('sh'), 'bash');
  assert.equal(normalizeLanguage('shell'), 'bash');
  assert.equal(normalizeLanguage('yml'), 'yaml');
  assert.equal(normalizeLanguage('md'), 'markdown');
});

test('unknown or empty languages render as plain text', () => {
  assert.equal(normalizeLanguage(undefined), null);
  assert.equal(normalizeLanguage(''), null);
  assert.equal(normalizeLanguage('cobol'), null);
});

test('every alias target is registered', () => {
  for (const l of ['py', 'ts', 'js', 'sh', 'yml', 'md', 'json', 'sql', 'tsx', 'jsx', 'diff', 'toml']) {
    const id = normalizeLanguage(l);
    assert.ok(id && (REGISTERED_LANGUAGES as readonly string[]).includes(id), `${l} -> ${id}`);
  }
});
