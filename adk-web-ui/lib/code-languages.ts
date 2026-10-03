export const REGISTERED_LANGUAGES = [
  'python', 'typescript', 'tsx', 'javascript', 'jsx', 'json', 'bash',
  'yaml', 'sql', 'markdown', 'diff', 'toml',
] as const;

const ALIASES: Record<string, (typeof REGISTERED_LANGUAGES)[number]> = {
  py: 'python', python: 'python',
  ts: 'typescript', typescript: 'typescript', tsx: 'tsx',
  js: 'javascript', javascript: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
  json: 'json', jsonc: 'json',
  sh: 'bash', bash: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  yml: 'yaml', yaml: 'yaml',
  sql: 'sql', md: 'markdown', markdown: 'markdown',
  diff: 'diff', patch: 'diff', toml: 'toml',
};

export function normalizeLanguage(lang: string | undefined): string | null {
  if (!lang) return null;
  return ALIASES[lang.trim().toLowerCase()] ?? null;
}
