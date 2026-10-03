import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseThemePref, resolveTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from './theme';

test('parseThemePref accepts the three values', () => {
  assert.equal(parseThemePref('light'), 'light');
  assert.equal(parseThemePref('dark'), 'dark');
  assert.equal(parseThemePref('system'), 'system');
});

test('parseThemePref falls back to system', () => {
  for (const v of [null, undefined, '', 'DARK', 'blue', 1, {}]) assert.equal(parseThemePref(v), 'system');
});

test('resolveTheme', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

function runInitScript(stored: string | null, prefersDark: boolean, throwOnStorage = false) {
  const classes = new Set<string>();
  const style: Record<string, string> = {};
  const document = { documentElement: { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) }, style } };
  const window = { matchMedia: () => ({ matches: prefersDark }) };
  const localStorage = { getItem: (k: string) => { if (throwOnStorage) throw new Error('blocked'); return k === THEME_STORAGE_KEY ? stored : null; } };
  new Function('document', 'window', 'localStorage', THEME_INIT_SCRIPT)(document, window, localStorage);
  return { dark: classes.has('dark'), scheme: style.colorScheme };
}

test('init script applies stored or system theme', () => {
  assert.deepEqual(runInitScript('dark', false), { dark: true, scheme: 'dark' });
  assert.deepEqual(runInitScript('light', true), { dark: false, scheme: 'light' });
  assert.deepEqual(runInitScript(null, true), { dark: true, scheme: 'dark' });
  assert.deepEqual(runInitScript('garbage', false), { dark: false, scheme: 'light' });
});

test('init script survives blocked storage', () => {
  assert.deepEqual(runInitScript(null, true, true), { dark: true, scheme: 'dark' });
});
