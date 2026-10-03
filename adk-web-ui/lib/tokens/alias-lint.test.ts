import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFiles, findAliasUsages } from './alias-lint';

test('finds deprecated alias utilities', () => {
  const src = `<div className="bg-background text-muted-foreground border-border hover:bg-primary/90">`;
  assert.deepEqual(findAliasUsages(src).map((u) => u.match), ['bg-background', 'text-muted-foreground', 'border-border', 'bg-primary']);
});

test('ignores md-* tokens and unrelated words', () => {
  const src = `<div className="bg-md-primary text-md-on-surface border-md-outline">primary muted border</div>`;
  assert.deepEqual(findAliasUsages(src), []);
});

test('checkFiles flags files above their allowance and new files', () => {
  const files = [
    { path: 'a.tsx', source: 'bg-card text-foreground' },
    { path: 'b.tsx', source: 'bg-card' },
    { path: 'c.tsx', source: 'bg-md-surface' },
  ];
  const { violations } = checkFiles(files, { 'a.tsx': 1 });
  assert.deepEqual(violations, [
    { path: 'a.tsx', count: 2, allowed: 1 },
    { path: 'b.tsx', count: 1, allowed: 0 },
  ]);
});
