import type { Build, BuildModels } from './types';

/** Same caps as package_agent, so the UI never trusts more than the backend writes. */
const LIMITS = { name: 100, description: 2000, model: 200, item: 64, items: 50, options: 30, artifact: 255, date: 40 };
const ARTIFACT_RE = /^[^/\\\u0000-\u001f\u007f]+\.zip$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v : null;
}

function count(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

function names(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .slice(0, LIMITS.items)
    .map((x) => x.slice(0, LIMITS.item));
}

function options(v: unknown): Record<string, boolean> {
  if (!isRecord(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(v).slice(0, LIMITS.options)) {
    if (typeof value === 'boolean' && key.length <= LIMITS.item) out[key] = value;
  }
  return out;
}

function models(v: unknown): BuildModels {
  const m = isRecord(v) ? v : {};
  return { fast: text(m.fast, LIMITS.model), reasoning: text(m.reasoning, LIMITS.model) };
}

/** Validated `state["builder:build"]`, or null. Used on stream data and stored messages. */
export function parseBuild(raw: unknown): Build | null {
  if (!isRecord(raw)) return null;
  const name = text(raw.name, LIMITS.name);
  const pkg = text(raw.package, LIMITS.name);
  const artifact = text(raw.artifact, LIMITS.artifact);
  const version = count(raw.version);
  if (!name || !pkg || !artifact || !ARTIFACT_RE.test(artifact) || artifact.includes('..') || version === null) {
    return null;
  }
  return {
    name,
    package: pkg,
    description: typeof raw.description === 'string' ? raw.description.slice(0, LIMITS.description) : '',
    options: options(raw.options),
    models: models(raw.models),
    tools: names(raw.tools),
    skills: names(raw.skills),
    artifact,
    version,
    files: count(raw.files) ?? 0,
    bytes: count(raw.bytes) ?? 0,
    packagedAt: text(raw.packagedAt, LIMITS.date) ?? '',
  };
}
