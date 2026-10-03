import type {
  Blueprint,
  BlueprintAgent,
  BlueprintAgentKind,
  BlueprintDataSource,
  BlueprintModelChoice,
  BlueprintTool,
  BlueprintToolKind,
} from './types';

const AGENT_KINDS = new Set<BlueprintAgentKind>(['llm', 'sequential', 'parallel', 'loop', 'custom']);
const TOOL_KINDS = new Set<BlueprintToolKind>(['builtin', 'function', 'mcp', 'openapi', 'agent', 'other']);
const FENCE_RE = /```blueprintjson\s*([\s\S]*?)```/i;

/** Same bounds as the Pydantic model, so client and server agree on "valid". */
const LIMITS = { short: 120, text: 1000, list: 30, code: 20_000 };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v : null;
}

function optStr(v: unknown, max: number): string | undefined | null {
  if (v === undefined || v === null) return undefined;
  return str(v, max);
}

function strList(v: unknown, maxItems = LIMITS.list, maxLen = LIMITS.text): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > maxItems) return null;
  const out: string[] = [];
  for (const item of v) {
    const s = str(item, maxLen);
    if (s === null) return null;
    out.push(s);
  }
  return out;
}

function list<T>(v: unknown, parse: (raw: unknown) => T | null, maxItems = LIMITS.list): T[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > maxItems) return null;
  const out: T[] = [];
  for (const item of v) {
    const parsed = parse(item);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

function parseAgent(raw: unknown): BlueprintAgent | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name, LIMITS.short);
  const role = str(raw.role, LIMITS.text);
  const kind = (raw.kind ?? 'llm') as BlueprintAgentKind;
  const model = optStr(raw.model, LIMITS.short);
  const tools = strList(raw.tools, 20, LIMITS.short);
  const subAgents = strList(raw.subAgents, 20, LIMITS.short);
  if (!name || !role || !AGENT_KINDS.has(kind) || model === null || !tools || !subAgents) return null;
  return { name, role, kind, ...(model ? { model } : {}), tools, subAgents };
}

function parseTool(raw: unknown): BlueprintTool | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name, LIMITS.short);
  const purpose = str(raw.purpose, LIMITS.text);
  const kind = (raw.kind ?? 'function') as BlueprintToolKind;
  return name && purpose && TOOL_KINDS.has(kind) ? { name, kind, purpose } : null;
}

function parseDataSource(raw: unknown): BlueprintDataSource | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name, LIMITS.short);
  const purpose = str(raw.purpose, LIMITS.text);
  const access = optStr(raw.access, 200);
  if (!name || !purpose || access === null) return null;
  return { name, purpose, ...(access ? { access } : {}) };
}

function parseModel(raw: unknown): BlueprintModelChoice | null {
  if (!isRecord(raw)) return null;
  const model = str(raw.model, LIMITS.short);
  const reason = str(raw.reason, LIMITS.text);
  const usedBy = strList(raw.usedBy, 20, LIMITS.short);
  return model && reason && usedBy ? { model, usedBy, reason } : null;
}

/** Validated blueprint or null. Used on stream data, stored messages and API input. */
export function parseBlueprint(raw: unknown): Blueprint | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name, LIMITS.short);
  const goal = str(raw.goal, LIMITS.text);
  const agents = list(raw.agents, parseAgent, 20);
  const tools = list(raw.tools, parseTool);
  const dataSources = list(raw.dataSources, parseDataSource, 20);
  const models = list(raw.models, parseModel, 10);
  const risks = strList(raw.risks, 20);
  const nextSteps = strList(raw.nextSteps, 20);
  const codeSkeleton = optStr(raw.codeSkeleton, LIMITS.code);
  if (!name || !goal || !agents || agents.length === 0) return null;
  if (!tools || !dataSources || !models || !risks || !nextSteps || codeSkeleton === null) return null;
  return {
    name,
    goal,
    agents,
    tools,
    dataSources,
    models,
    risks,
    nextSteps,
    ...(codeSkeleton ? { codeSkeleton } : {}),
  };
}

/**
 * Fallback when the state_delta never arrived: pull a ```blueprintjson
 * fence out of the reply. Returns the text without the fence when it parsed.
 */
export function extractBlueprintFence(text: string): { blueprint: Blueprint | null; displayText: string } {
  const match = FENCE_RE.exec(text);
  if (!match) return { blueprint: null, displayText: text };
  let raw: unknown;
  try {
    raw = JSON.parse(match[1].trim());
  } catch {
    return { blueprint: null, displayText: text };
  }
  const blueprint = parseBlueprint(raw);
  return blueprint ? { blueprint, displayText: text.replace(FENCE_RE, '').trim() } : { blueprint: null, displayText: text };
}

/** Prefer the state_delta blueprint; otherwise try the fence. */
export function resolveBlueprintContent(
  text: string,
  fromState?: Blueprint | null,
): { content: string; blueprint: Blueprint | undefined } {
  const fenced = extractBlueprintFence(text);
  const blueprint = fromState ?? fenced.blueprint ?? undefined;
  return { content: blueprint ? fenced.displayText : text, blueprint };
}
