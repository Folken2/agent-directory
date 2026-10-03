/**
 * Insights over ADK conversations: how they go, where the builder funnel
 * leaks, and what people ask for. Pure functions over rows the ops queries
 * load, so every number here is unit-tested without Postgres.
 *
 * No model is involved. Topic and integration detection is keyword based on
 * purpose: every match can be explained by pointing at the words that
 * triggered it, and nothing leaves the database to be classified.
 */

export const BUILDER_APP = 'adk_agent_builder';

/** One ADK session, aggregated from its events. */
export type ConversationRow = {
  appName: string;
  userId: string;
  sessionId: string;
  /** Email for signed-in users, null for anonymous ones. */
  userEmail: string | null;
  startedAt: string;
  lastAt: string;
  /** User messages with text (tool responses excluded). */
  userTurns: number;
  agentMessages: number;
  toolCalls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  /** User message texts in order, each truncated. */
  prompts: string[];
  /** Time from the first user message to the first agent response. */
  firstReplyMs: number | null;
  hasBlueprint: boolean;
  saved: boolean;
};

export type ToolUsageRow = { agentSlug: string; tool: string; calls: number; conversations: number };

export type TranscriptEntry = {
  author: string;
  at: string;
  text: string | null;
  toolCalls: string[];
  toolResults: string[];
  error: string | null;
};

export type ConversationOutcome = 'saved' | 'blueprint' | 'error' | 'one-and-done' | 'engaged' | 'short';

export const OUTCOME_LABELS: Record<ConversationOutcome, string> = {
  saved: 'Blueprint saved',
  blueprint: 'Blueprint',
  error: 'Error',
  'one-and-done': 'Single message',
  engaged: 'Engaged',
  short: 'Short',
};

/** The single most important thing that happened, best outcome first. */
export function conversationOutcome(c: Pick<ConversationRow, 'saved' | 'hasBlueprint' | 'errors' | 'userTurns'>): ConversationOutcome {
  if (c.saved) return 'saved';
  if (c.hasBlueprint) return 'blueprint';
  if (c.errors > 0) return 'error';
  if (c.userTurns <= 1) return 'one-and-done';
  if (c.userTurns >= 3) return 'engaged';
  return 'short';
}

// ---------------------------------------------------------------------------
// Friction
// ---------------------------------------------------------------------------

const FRICTION_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'not working', re: /\b(?:doesn'?t|does not|didn'?t|did not|isn'?t|not) work(?:ing|s)?\b|\bno funciona\b/i },
  { id: 'wrong answer', re: /\b(?:wrong|incorrect|inaccurate|mal(?:o|a)?)\b|\bno es correcto\b/i },
  { id: 'not what I asked', re: /\bnot what i (?:asked|wanted|meant|said)\b|\bthat'?s not (?:it|right|what)\b|\bno es (?:lo que|eso)\b/i },
  { id: 'confused', re: /\b(?:confus\w*|don'?t understand|no entiendo|makes no sense)\b/i },
  { id: 'error', re: /\b(?:error|bug|broken|crash\w*|stuck|failed)\b/i },
  { id: 'frustrated', re: /\b(?:useless|frustrat\w*|annoying|terrible|awful)\b/i },
];

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 2)
  );
}

/** Jaccard overlap of word sets, 0..1. */
export function similarity(a: string, b: string): number {
  const x = tokenSet(a);
  const y = tokenSet(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared++;
  return shared / (x.size + y.size - shared);
}

/**
 * Why a conversation looks rough, from the user's own words: complaints, or
 * sending nearly the same message twice in a row (rephrasing after a miss).
 */
export function frictionReasons(prompts: readonly string[]): string[] {
  const reasons = new Set<string>();
  // The first message describes the task; complaints come after a reply.
  for (const prompt of prompts.slice(1)) {
    for (const { id, re } of FRICTION_PATTERNS) if (re.test(prompt)) reasons.add(id);
  }
  for (let i = 1; i < prompts.length; i++) {
    if (similarity(prompts[i - 1], prompts[i]) >= 0.6) {
      reasons.add('repeated message');
      break;
    }
  }
  return [...reasons];
}

// ---------------------------------------------------------------------------
// What people ask for
// ---------------------------------------------------------------------------

type Matcher = { id: string; label: string; re: RegExp };

/** Products and services people want their agents to work with. */
export const INTEGRATIONS: readonly Matcher[] = [
  { id: 'gmail', label: 'Gmail', re: /\bg-?mail\b/i },
  { id: 'outlook', label: 'Outlook / Microsoft 365', re: /\b(?:outlook|office ?365|microsoft 365|sharepoint|ms teams|microsoft teams)\b/i },
  { id: 'google-drive', label: 'Google Drive / Docs', re: /\bgoogle (?:drive|docs?)\b/i },
  { id: 'google-sheets', label: 'Google Sheets / Excel', re: /\b(?:google sheets?|spreadsheets?|excel|hojas? de c[aá]lculo)\b/i },
  { id: 'google-calendar', label: 'Calendar', re: /\b(?:google calendar|calendar|calendario)\b/i },
  { id: 'slack', label: 'Slack', re: /\bslack\b/i },
  { id: 'notion', label: 'Notion', re: /\bnotion\b/i },
  { id: 'github', label: 'GitHub / GitLab', re: /\b(?:github|gitlab|pull requests?)\b/i },
  { id: 'jira', label: 'Jira / Confluence', re: /\b(?:jira|confluence)\b/i },
  { id: 'salesforce', label: 'Salesforce', re: /\bsalesforce\b/i },
  { id: 'hubspot', label: 'HubSpot', re: /\bhubspot\b/i },
  { id: 'zendesk', label: 'Zendesk / Intercom', re: /\b(?:zendesk|intercom|freshdesk)\b/i },
  { id: 'shopify', label: 'Shopify', re: /\bshopify\b/i },
  { id: 'stripe', label: 'Stripe', re: /\bstripe\b/i },
  { id: 'whatsapp', label: 'WhatsApp / Telegram', re: /\b(?:whatsapp|telegram)\b/i },
  { id: 'discord', label: 'Discord', re: /\bdiscord\b/i },
  { id: 'linkedin', label: 'LinkedIn', re: /\blinkedin\b/i },
  { id: 'twitter', label: 'X / Twitter', re: /\b(?:twitter|tweets?)\b/i },
  { id: 'youtube', label: 'YouTube', re: /\byoutube\b/i },
  { id: 'database', label: 'SQL databases', re: /\b(?:postgres(?:ql)?|mysql|sql server|sqlite|bigquery|snowflake|supabase|sql)\b/i },
  { id: 'airtable', label: 'Airtable', re: /\bairtable\b/i },
  { id: 'trello', label: 'Trello / Asana', re: /\b(?:trello|asana|monday\.com|clickup)\b/i },
  { id: 'maps', label: 'Google Maps', re: /\bgoogle maps\b/i },
];

/** Broad business areas, so the owner sees which markets show up. */
export const DOMAINS: readonly Matcher[] = [
  { id: 'support', label: 'Customer support', re: /\b(?:customer support|support (?:emails?|tickets?)|help ?desk|tickets?|refunds?|faqs?|soporte|atenci[oó]n al cliente)\b/i },
  { id: 'sales', label: 'Sales & CRM', re: /\b(?:sales|leads?|prospect\w*|outreach|crm|deals?|ventas)\b/i },
  { id: 'marketing', label: 'Marketing & content', re: /\b(?:marketing|seo|blog(?: posts?)?|newsletters?|social media|campaigns?|copywriting|contenido)\b/i },
  { id: 'research', label: 'Research', re: /\b(?:research\w*|investiga\w*|literature|papers?|competitors?|market analysis)\b/i },
  { id: 'data', label: 'Data & analytics', re: /\b(?:data(?:set)?s?|csv|analytics|dashboards?|charts?|metrics|datos|kpis?)\b/i },
  { id: 'engineering', label: 'Software engineering', re: /\b(?:code|coding|repositor(?:y|ies)|pull requests?|bugs?|deploy\w*|devops|api)\b/i },
  { id: 'finance', label: 'Finance & accounting', re: /\b(?:invoices?|accounting|finance|budget\w*|expenses?|payments?|facturas?|stocks?|trading)\b/i },
  { id: 'legal', label: 'Legal & compliance', re: /\b(?:contracts?|legal|compliance|gdpr|regulat\w*|policy|policies)\b/i },
  { id: 'hr', label: 'HR & recruiting', re: /\b(?:hr|hiring|recruit\w*|candidates?|cvs?|resumes?|onboarding|employees?)\b/i },
  { id: 'education', label: 'Education', re: /\b(?:students?|tutor\w*|teach\w*|lessons?|quiz\w*|courses?|homework|alumnos?)\b/i },
  { id: 'health', label: 'Healthcare', re: /\b(?:patients?|clinics?|medical|health\w*|doctors?|appointments?)\b/i },
  { id: 'travel', label: 'Travel & local', re: /\b(?:trips?|travel\w*|itinerar\w*|hotels?|flights?|restaurants?|viajes?)\b/i },
  { id: 'ecommerce', label: 'E-commerce', re: /\b(?:e-?commerce|orders|order (?:status|tracking)|inventory|products|online store|shop(?:s|ping|ify)?|pedidos?)\b/i },
  { id: 'productivity', label: 'Personal productivity', re: /\b(?:emails?|inbox|meetings?|schedul\w*|reminders?|to-?dos?|notes)\b/i },
];

export function matchAll(text: string, matchers: readonly Matcher[]): string[] {
  return matchers.filter((m) => m.re.test(text)).map((m) => m.id);
}

const LANGUAGE_HINTS: Array<{ id: string; words: RegExp }> = [
  { id: 'es', words: /\b(?:que|para|con|una|los|las|necesito|quiero|agente|por favor|como|del)\b/gi },
  { id: 'pt', words: /\b(?:você|para|com|uma|os|não|preciso|quero|agente|então)\b/gi },
  { id: 'fr', words: /\b(?:qui|pour|avec|une|les|des|je|veux|est|dans|et)\b/gi },
  { id: 'de', words: /\b(?:und|für|mit|eine|der|die|das|ich|möchte|nicht|ist)\b/gi },
  { id: 'it', words: /\b(?:che|per|con|una|gli|il|voglio|agente|sono|della)\b/gi },
];
const EN_WORDS = /\b(?:the|and|for|with|that|this|want|need|an|to|of|is|from|my|our)\b/gi;

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  ar: 'Arabic',
  other: 'Other',
};

/** Rough language of a message: script first, then common function words. */
export function detectLanguage(text: string): string {
  if (/[぀-ヿ]/.test(text)) return 'ja';
  if (/[가-힯]/.test(text)) return 'ko';
  if (/[一-鿿]/.test(text)) return 'zh';
  if (/[Ѐ-ӿ]/.test(text)) return 'ru';
  if (/[؀-ۿ]/.test(text)) return 'ar';
  const count = (re: RegExp) => (text.match(re) ?? []).length;
  let best = { id: 'en', score: count(EN_WORDS) };
  for (const { id, words } of LANGUAGE_HINTS) {
    const score = count(words);
    if (score > best.score) best = { id, score };
  }
  return best.score === 0 && !/[a-z]/i.test(text) ? 'other' : best.id;
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export type ShareRow = { id: string; label: string; count: number; share: number };

/** Counts as a share of `denominator` (not of the sum: labels can overlap). */
export function rankByShareOf(
  counts: Map<string, number>,
  denominator: number,
  labels: Record<string, string>,
  limit = 10
): ShareRow[] {
  if (denominator <= 0) return [];
  return [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, count]) => ({ id, label: labels[id] ?? id, count, share: Math.round((count / denominator) * 1000) / 10 }));
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

function rate(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

export type ConversationOverview = {
  conversations: number;
  messages: number;
  people: number;
  returningPeople: number;
  signedInShare: number;
  avgTurns: number;
  oneAndDoneRate: number;
  engagedRate: number;
  errorRate: number;
  frictionRate: number;
  medianFirstReplyMs: number | null;
  p90FirstReplyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  avgTokensPerConversation: number;
};

export function summarizeConversations(rows: readonly ConversationRow[]): ConversationOverview {
  const n = rows.length;
  const byUser = new Map<string, number>();
  let messages = 0;
  let signedIn = 0;
  let oneAndDone = 0;
  let engaged = 0;
  let errored = 0;
  let friction = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const replies: number[] = [];

  for (const c of rows) {
    byUser.set(c.userId, (byUser.get(c.userId) ?? 0) + 1);
    messages += c.userTurns;
    if (c.userId.startsWith('u_')) signedIn++;
    if (c.userTurns <= 1) oneAndDone++;
    if (c.userTurns >= 3) engaged++;
    if (c.errors > 0) errored++;
    if (frictionReasons(c.prompts).length > 0) friction++;
    inputTokens += c.inputTokens;
    outputTokens += c.outputTokens;
    if (c.firstReplyMs !== null && c.firstReplyMs >= 0) replies.push(c.firstReplyMs);
  }
  replies.sort((a, b) => a - b);

  return {
    conversations: n,
    messages,
    people: byUser.size,
    returningPeople: [...byUser.values()].filter((v) => v > 1).length,
    signedInShare: rate(signedIn, n),
    avgTurns: n ? Math.round((messages / n) * 10) / 10 : 0,
    oneAndDoneRate: rate(oneAndDone, n),
    engagedRate: rate(engaged, n),
    errorRate: rate(errored, n),
    frictionRate: rate(friction, n),
    medianFirstReplyMs: percentile(replies, 0.5),
    p90FirstReplyMs: percentile(replies, 0.9),
    inputTokens,
    outputTokens,
    avgTokensPerConversation: n ? Math.round((inputTokens + outputTokens) / n) : 0,
  };
}

export type AgentHealthRow = {
  agentSlug: string;
  conversations: number;
  avgTurns: number;
  oneAndDoneRate: number;
  errorRate: number;
  frictionRate: number;
  medianFirstReplyMs: number | null;
  avgTokens: number;
};

export function agentHealth(rows: readonly ConversationRow[]): AgentHealthRow[] {
  const groups = new Map<string, ConversationRow[]>();
  for (const c of rows) {
    const list = groups.get(c.appName) ?? [];
    list.push(c);
    groups.set(c.appName, list);
  }
  return [...groups.entries()]
    .map(([agentSlug, list]) => {
      const s = summarizeConversations(list);
      return {
        agentSlug,
        conversations: s.conversations,
        avgTurns: s.avgTurns,
        oneAndDoneRate: s.oneAndDoneRate,
        errorRate: s.errorRate,
        frictionRate: s.frictionRate,
        medianFirstReplyMs: s.medianFirstReplyMs,
        avgTokens: s.avgTokensPerConversation,
      };
    })
    .sort((a, b) => b.conversations - a.conversations || a.agentSlug.localeCompare(b.agentSlug));
}

export type FunnelStep = { id: string; label: string; count: number; ofFirst: number; ofPrevious: number };

/** Builder conversations → kept going → got a blueprint → saved it. */
export function builderFunnel(rows: readonly ConversationRow[]): FunnelStep[] {
  const builder = rows.filter((c) => c.appName === BUILDER_APP);
  const steps = [
    { id: 'started', label: 'Started a design', count: builder.length },
    { id: 'continued', label: 'Answered a follow-up', count: builder.filter((c) => c.userTurns >= 2).length },
    { id: 'blueprint', label: 'Got a blueprint', count: builder.filter((c) => c.hasBlueprint).length },
    { id: 'saved', label: 'Saved it', count: builder.filter((c) => c.saved).length },
  ];
  return steps.map((step, i) => ({
    ...step,
    ofFirst: rate(step.count, steps[0].count),
    ofPrevious: i === 0 ? 100 : rate(step.count, steps[i - 1].count),
  }));
}

export type DemandInsights = {
  /** Conversations whose first message was typed, not a suggestion click. */
  organicConversations: number;
  suggestionConversations: number;
  integrations: ShareRow[];
  domains: ShareRow[];
  languages: ShareRow[];
};

/**
 * What people come for, read from the first message of each conversation.
 * Suggestion clicks are set aside: they show what we offered, not demand.
 */
export function demandInsights(
  rows: readonly ConversationRow[],
  isSuggestion: (text: string) => boolean
): DemandInsights {
  const integrations = new Map<string, number>();
  const domains = new Map<string, number>();
  const languages = new Map<string, number>();
  let organic = 0;
  let suggested = 0;

  for (const c of rows) {
    const first = c.prompts[0];
    if (!first) continue;
    if (isSuggestion(first)) {
      suggested++;
      continue;
    }
    organic++;
    // Integrations can come up in any message; the topic is set by the first.
    const all = c.prompts.join('\n');
    for (const id of matchAll(all, INTEGRATIONS)) integrations.set(id, (integrations.get(id) ?? 0) + 1);
    for (const id of matchAll(first, DOMAINS)) domains.set(id, (domains.get(id) ?? 0) + 1);
    const lang = detectLanguage(first);
    languages.set(lang, (languages.get(lang) ?? 0) + 1);
  }

  const labels = (list: readonly Matcher[]) => Object.fromEntries(list.map((m) => [m.id, m.label]));
  return {
    organicConversations: organic,
    suggestionConversations: suggested,
    integrations: rankByShareOf(integrations, organic, labels(INTEGRATIONS), 12),
    domains: rankByShareOf(domains, organic, labels(DOMAINS), 14),
    languages: rankByShareOf(languages, organic, LANGUAGE_LABELS, 8),
  };
}

// ---------------------------------------------------------------------------
// Blueprints
// ---------------------------------------------------------------------------

export type BlueprintRecord = {
  sessionId: string;
  userId: string;
  updatedAt: string;
  saved: boolean;
  doc: unknown;
};

type BpAgent = { kind?: string; tools?: unknown; subAgents?: unknown };
type BpDoc = {
  name?: unknown;
  goal?: unknown;
  agents?: BpAgent[];
  tools?: Array<{ name?: unknown; kind?: unknown }>;
  models?: Array<{ model?: unknown }>;
  dataSources?: unknown[];
};

const ARCHITECTURE_LABELS: Record<string, string> = {
  single: 'Single agent',
  sequential: 'Sequential pipeline',
  parallel: 'Parallel fan-out',
  loop: 'Loop (draft and refine)',
  routed: 'Coordinator with sub-agents',
  custom: 'Custom orchestration',
};

const TOOL_KIND_LABELS: Record<string, string> = {
  builtin: 'Built-in (search, code)',
  function: 'Custom function',
  mcp: 'MCP server',
  openapi: 'OpenAPI / REST',
  agent: 'Agent as tool',
  other: 'Other',
};

export function blueprintArchitecture(doc: unknown): string {
  const raw = (doc as BpDoc | null)?.agents;
  const agents = (Array.isArray(raw) ? raw : []).filter(Boolean);
  const kinds = new Set(agents.map((a) => String(a.kind ?? 'llm')));
  for (const kind of ['sequential', 'parallel', 'loop', 'custom']) if (kinds.has(kind)) return kind;
  return agents.length <= 1 ? 'single' : 'routed';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export type BlueprintSummary = {
  sessionId: string;
  name: string;
  goal: string;
  agents: number;
  tools: string[];
  architecture: string;
  saved: boolean;
  updatedAt: string;
};

export type BlueprintInsights = {
  total: number;
  saved: number;
  avgAgents: number;
  withDataSources: number;
  architectures: ShareRow[];
  toolKinds: ShareRow[];
  tools: ShareRow[];
  models: ShareRow[];
  recent: BlueprintSummary[];
};

export function blueprintInsights(records: readonly BlueprintRecord[], recentLimit = 12): BlueprintInsights {
  const architectures = new Map<string, number>();
  const toolKinds = new Map<string, number>();
  const tools = new Map<string, number>();
  const toolLabels: Record<string, string> = {};
  const models = new Map<string, number>();
  let agentCount = 0;
  let withData = 0;
  let saved = 0;
  const summaries: BlueprintSummary[] = [];

  for (const r of records) {
    const doc = (r.doc ?? {}) as BpDoc;
    const agents = Array.isArray(doc.agents) ? doc.agents : [];
    const docTools = Array.isArray(doc.tools) ? doc.tools : [];
    const arch = blueprintArchitecture(doc);
    architectures.set(arch, (architectures.get(arch) ?? 0) + 1);
    agentCount += agents.length;
    if (Array.isArray(doc.dataSources) && doc.dataSources.length > 0) withData++;
    if (r.saved) saved++;

    // Each blueprint counts a tool or kind once, however many agents use it.
    const kinds = new Set(docTools.map((t) => str(t.kind) || 'other'));
    for (const k of kinds) toolKinds.set(k, (toolKinds.get(k) ?? 0) + 1);
    const names = new Set<string>();
    for (const t of docTools) {
      const label = str(t.name);
      if (!label) continue;
      const id = label.toLowerCase();
      names.add(id);
      toolLabels[id] ??= label;
    }
    for (const id of names) tools.set(id, (tools.get(id) ?? 0) + 1);
    const modelNames = new Set((Array.isArray(doc.models) ? doc.models : []).map((m) => str(m.model)).filter(Boolean));
    for (const m of modelNames) models.set(m, (models.get(m) ?? 0) + 1);

    summaries.push({
      sessionId: r.sessionId,
      name: str(doc.name) || 'Untitled design',
      goal: str(doc.goal),
      agents: agents.length,
      tools: [...names].map((id) => toolLabels[id]),
      architecture: ARCHITECTURE_LABELS[arch],
      saved: r.saved,
      updatedAt: r.updatedAt,
    });
  }

  const total = records.length;
  const modelLabels = Object.fromEntries([...models.keys()].map((m) => [m, m]));
  return {
    total,
    saved,
    avgAgents: total ? Math.round((agentCount / total) * 10) / 10 : 0,
    withDataSources: withData,
    architectures: rankByShareOf(architectures, total, ARCHITECTURE_LABELS, 6),
    toolKinds: rankByShareOf(toolKinds, total, TOOL_KIND_LABELS, 6),
    tools: rankByShareOf(tools, total, toolLabels, 12),
    models: rankByShareOf(models, total, modelLabels, 6),
    recent: summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, recentLimit),
  };
}

// ---------------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------------

export type Highlight = {
  id: string;
  /** risk: something leaking or failing; opportunity: demand to act on. */
  tone: 'risk' | 'opportunity' | 'info';
  title: string;
  detail: string;
};

/** Below this many conversations an agent's rates are too noisy to call out. */
export const MIN_SAMPLE = 10;

const pctText = (n: number) => `${Math.round(n)}%`;

/**
 * The few findings worth reading first, in plain sentences. Each one is a
 * threshold over the numbers shown below it, so it can be checked.
 */
export function buildHighlights(input: {
  overview: ConversationOverview;
  funnel: FunnelStep[];
  agents: AgentHealthRow[];
  demand: DemandInsights;
  blueprints: BlueprintInsights;
  nameOf?: (agentSlug: string) => string;
}): Highlight[] {
  const { overview, funnel, agents, demand, blueprints } = input;
  const nameOf = input.nameOf ?? ((s: string) => s);
  const out: Highlight[] = [];
  const sized = agents.filter((a) => a.conversations >= MIN_SAMPLE);
  const worst = (key: keyof AgentHealthRow) =>
    [...sized].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0))[0];

  // The weakest step of the builder funnel, judged on a real sample.
  const leaks = funnel.slice(1).filter((s, i) => funnel[i].count >= MIN_SAMPLE);
  const leak = [...leaks].sort((a, b) => a.ofPrevious - b.ofPrevious)[0];
  if (leak) {
    const sentence: Record<string, string> = {
      continued: `${pctText(100 - leak.ofPrevious)} of builder conversations stop after the first reply`,
      blueprint: `Only ${pctText(leak.ofPrevious)} of builder conversations that continue reach a blueprint`,
      saved: `Only ${pctText(leak.ofPrevious)} of blueprints get saved`,
    };
    out.push({
      id: 'funnel-leak',
      tone: 'risk',
      title: sentence[leak.id] ?? `${leak.label}: ${pctText(leak.ofPrevious)} of the step before`,
      detail: `Biggest drop in the builder funnel. ${pctText(funnel[funnel.length - 1].ofFirst)} of started designs end with a saved blueprint.`,
    });
  }

  if (overview.conversations >= MIN_SAMPLE && overview.oneAndDoneRate >= 30) {
    const agent = worst('oneAndDoneRate');
    out.push({
      id: 'single-message',
      tone: 'risk',
      title: `${pctText(overview.oneAndDoneRate)} of conversations end after one reply`,
      detail: agent ? `Highest for ${nameOf(agent.agentSlug)} at ${pctText(agent.oneAndDoneRate)}.` : 'Across all agents.',
    });
  }

  const friction = worst('frictionRate');
  if (friction && friction.frictionRate >= 20) {
    out.push({
      id: 'friction',
      tone: 'risk',
      title: `${nameOf(friction.agentSlug)}: friction in ${pctText(friction.frictionRate)} of conversations`,
      detail: 'People complained or sent the same message again. Read them under Conversations, filtered by Friction.',
    });
  }

  const errors = worst('errorRate');
  if (errors && errors.errorRate >= 10) {
    out.push({
      id: 'errors',
      tone: 'risk',
      title: `${nameOf(errors.agentSlug)} errors in ${pctText(errors.errorRate)} of conversations`,
      detail: 'Open its error conversations to see which tool or quota failed.',
    });
  }

  if (demand.organicConversations >= MIN_SAMPLE && (demand.domains[0] || demand.integrations[0])) {
    const domain = demand.domains[0];
    const integration = demand.integrations[0];
    out.push({
      id: 'demand',
      tone: 'opportunity',
      title: domain ? `Most asked for: ${domain.label} (${pctText(domain.share)})` : `Most named integration: ${integration.label}`,
      detail: integration
        ? `${integration.label} comes up in ${pctText(integration.share)} of typed conversations; worth an example agent.`
        : 'Share of conversations whose first message was typed, not a suggestion.',
    });
  }

  const mcp = blueprints.toolKinds.find((k) => k.id === 'mcp');
  if (blueprints.total >= MIN_SAMPLE && mcp && mcp.share >= 30) {
    out.push({
      id: 'mcp',
      tone: 'opportunity',
      title: `${pctText(mcp.share)} of blueprints need an MCP server`,
      detail: `Most proposed tools: ${blueprints.tools.slice(0, 3).map((t) => t.label).join(', ')}.`,
    });
  }

  const slow = [...sized].sort((a, b) => (b.medianFirstReplyMs ?? 0) - (a.medianFirstReplyMs ?? 0))[0];
  if (
    slow?.medianFirstReplyMs &&
    overview.medianFirstReplyMs &&
    slow.medianFirstReplyMs >= 10_000 &&
    slow.medianFirstReplyMs >= overview.medianFirstReplyMs * 1.2
  ) {
    out.push({
      id: 'latency',
      tone: 'info',
      title: `${nameOf(slow.agentSlug)} is the slowest to reply`,
      detail: `${(slow.medianFirstReplyMs / 1000).toFixed(1)} s median to the first response, against ${(overview.medianFirstReplyMs / 1000).toFixed(1)} s overall.`,
    });
  }

  const english = demand.languages.find((l) => l.id === 'en');
  const nonEnglish = 100 - (english?.share ?? 0);
  if (demand.organicConversations >= MIN_SAMPLE && nonEnglish >= 10) {
    const others = demand.languages.filter((l) => l.id !== 'en').slice(0, 2).map((l) => l.label);
    out.push({
      id: 'languages',
      tone: 'info',
      title: `${pctText(nonEnglish)} of first messages aren't in English`,
      detail: others.length ? `Mostly ${others.join(' and ')}.` : 'Across several languages.',
    });
  }

  return out;
}
