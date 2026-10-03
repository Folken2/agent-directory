const PREFIX = '(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|caret|accent|shadow)';
const NAMES = '(?:background|foreground|card-foreground|card|popover-foreground|popover|primary-foreground|primary|secondary-foreground|secondary|muted-foreground|muted|accent-foreground|accent|destructive-foreground|destructive|border|input|ring)';
const ALIAS_RE = new RegExp(`(?<![\\w-])${PREFIX}-${NAMES}(?![\\w-])`, 'g');

export function findAliasUsages(source: string): Array<{ line: number; match: string }> {
  const out: Array<{ line: number; match: string }> = [];
  source.split('\n').forEach((text, i) => {
    for (const m of text.matchAll(ALIAS_RE)) out.push({ line: i + 1, match: m[0] });
  });
  return out;
}

export function checkFiles(
  files: Array<{ path: string; source: string }>,
  allowlist: Record<string, number>
): { violations: Array<{ path: string; count: number; allowed: number }> } {
  const violations = files
    .map((f) => ({ path: f.path, count: findAliasUsages(f.source).length, allowed: allowlist[f.path] ?? 0 }))
    .filter((r) => r.count > r.allowed);
  return { violations };
}
