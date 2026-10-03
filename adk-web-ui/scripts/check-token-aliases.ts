import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { checkFiles, findAliasUsages } from '../lib/tokens/alias-lint';

const ALLOWLIST_PATH = 'scripts/token-alias-allowlist.json';
// Recursive walk (fs.globSync is not in the installed @types/node).
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}
const files = ['app', 'components'].flatMap(walk).map((path) => ({ path, source: readFileSync(path, 'utf8') }));

if (process.argv.includes('--write-allowlist')) {
  const counts = Object.fromEntries(
    files.map((f) => [f.path, findAliasUsages(f.source).length] as const).filter(([, n]) => n > 0).sort()
  );
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(counts, null, 2) + '\n');
  console.log(`wrote ${Object.keys(counts).length} entries`);
  process.exit(0);
}

const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as Record<string, number>;
const { violations } = checkFiles(files, allowlist);
for (const v of violations) {
  console.error(`${v.path}: ${v.count} deprecated color aliases (allowed ${v.allowed}). Use md-* tokens.`);
}
process.exit(violations.length ? 1 : 0);
