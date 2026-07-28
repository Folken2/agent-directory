/**
 * Maps a detected crawler to the company that operates it (its "mother company")
 * and to what the crawl is actually for. Bot names come from `identifyBot`.
 */

export type BotPurpose =
  | 'training'
  | 'ai-answers'
  | 'indexing'
  | 'preview'
  | 'seo'
  | 'monitoring'
  | 'other';

export const PURPOSE_LABEL: Record<BotPurpose, string> = {
  training: 'Training',
  'ai-answers': 'AI answers',
  indexing: 'Indexing',
  preview: 'Link previews',
  seo: 'SEO',
  monitoring: 'Monitoring',
  other: 'Other',
};

export type BotCompany = {
  id: string;
  name: string;
  /** Brand colour, used for the logo tile. */
  color: string;
};

export const BOT_COMPANIES = {
  anthropic: { id: 'anthropic', name: 'Anthropic', color: '#D97757' },
  openai: { id: 'openai', name: 'OpenAI', color: '#0F0F0F' },
  google: { id: 'google', name: 'Google', color: '#4285F4' },
  meta: { id: 'meta', name: 'Meta', color: '#0866FF' },
  microsoft: { id: 'microsoft', name: 'Microsoft', color: '#00A4EF' },
  apple: { id: 'apple', name: 'Apple', color: '#1D1D1F' },
  amazon: { id: 'amazon', name: 'Amazon', color: '#FF9900' },
  bytedance: { id: 'bytedance', name: 'ByteDance', color: '#FE2C55' },
  perplexity: { id: 'perplexity', name: 'Perplexity', color: '#20808D' },
  commoncrawl: { id: 'commoncrawl', name: 'Common Crawl', color: '#3B6EA5' },
  cohere: { id: 'cohere', name: 'Cohere', color: '#39594D' },
  diffbot: { id: 'diffbot', name: 'Diffbot', color: '#2B6CB0' },
  you: { id: 'you', name: 'You.com', color: '#6C5CE7' },
  yandex: { id: 'yandex', name: 'Yandex', color: '#FC3F1D' },
  baidu: { id: 'baidu', name: 'Baidu', color: '#2932E1' },
  duckduckgo: { id: 'duckduckgo', name: 'DuckDuckGo', color: '#DE5833' },
  yahoo: { id: 'yahoo', name: 'Yahoo', color: '#6001D2' },
  huawei: { id: 'huawei', name: 'Huawei', color: '#CF0A2C' },
  salesforce: { id: 'salesforce', name: 'Salesforce', color: '#00A1E0' },
  x: { id: 'x', name: 'X', color: '#0F0F0F' },
  discord: { id: 'discord', name: 'Discord', color: '#5865F2' },
  telegram: { id: 'telegram', name: 'Telegram', color: '#26A5E4' },
  ahrefs: { id: 'ahrefs', name: 'Ahrefs', color: '#FF8C00' },
  semrush: { id: 'semrush', name: 'Semrush', color: '#FF642D' },
  moz: { id: 'moz', name: 'Moz', color: '#0EA5E9' },
  majestic: { id: 'majestic', name: 'Majestic', color: '#7C3AED' },
  dataforseo: { id: 'dataforseo', name: 'DataForSEO', color: '#1E88E5' },
  screamingfrog: { id: 'screamingfrog', name: 'Screaming Frog', color: '#22A45D' },
  uptimerobot: { id: 'uptimerobot', name: 'UptimeRobot', color: '#3BD671' },
  solarwinds: { id: 'solarwinds', name: 'SolarWinds', color: '#F58220' },
  statuscake: { id: 'statuscake', name: 'StatusCake', color: '#1BA0E1' },
  vercel: { id: 'vercel', name: 'Vercel', color: '#0F0F0F' },
  unknown: { id: 'unknown', name: 'Unidentified', color: '#94A3B8' },
} as const satisfies Record<string, BotCompany>;

export type BotCompanyId = keyof typeof BOT_COMPANIES;

type BotProfile = { company: BotCompanyId; purpose: BotPurpose };

const BOT_PROFILES: Record<string, BotProfile> = {
  // OpenAI
  GPTBot: { company: 'openai', purpose: 'training' },
  'ChatGPT-User': { company: 'openai', purpose: 'ai-answers' },
  'OAI-SearchBot': { company: 'openai', purpose: 'indexing' },

  // Anthropic
  ClaudeBot: { company: 'anthropic', purpose: 'training' },

  // Other AI labs
  PerplexityBot: { company: 'perplexity', purpose: 'ai-answers' },
  'Google-Extended': { company: 'google', purpose: 'training' },
  Amazonbot: { company: 'amazon', purpose: 'training' },
  Bytespider: { company: 'bytedance', purpose: 'training' },
  CCBot: { company: 'commoncrawl', purpose: 'training' },
  'cohere-ai': { company: 'cohere', purpose: 'training' },
  Diffbot: { company: 'diffbot', purpose: 'training' },
  YouBot: { company: 'you', purpose: 'ai-answers' },
  'meta-externalagent': { company: 'meta', purpose: 'training' },

  // Search indexing
  Googlebot: { company: 'google', purpose: 'indexing' },
  Bingbot: { company: 'microsoft', purpose: 'indexing' },
  DuckDuckBot: { company: 'duckduckgo', purpose: 'indexing' },
  YandexBot: { company: 'yandex', purpose: 'indexing' },
  Baiduspider: { company: 'baidu', purpose: 'indexing' },
  Applebot: { company: 'apple', purpose: 'indexing' },
  PetalBot: { company: 'huawei', purpose: 'indexing' },
  Slurp: { company: 'yahoo', purpose: 'indexing' },

  // Link previews / social
  facebookexternalhit: { company: 'meta', purpose: 'preview' },
  WhatsApp: { company: 'meta', purpose: 'preview' },
  Twitterbot: { company: 'x', purpose: 'preview' },
  LinkedInBot: { company: 'microsoft', purpose: 'preview' },
  Discordbot: { company: 'discord', purpose: 'preview' },
  TelegramBot: { company: 'telegram', purpose: 'preview' },
  Slackbot: { company: 'salesforce', purpose: 'preview' },

  // SEO tooling
  AhrefsBot: { company: 'ahrefs', purpose: 'seo' },
  SemrushBot: { company: 'semrush', purpose: 'seo' },
  DotBot: { company: 'moz', purpose: 'seo' },
  MJ12bot: { company: 'majestic', purpose: 'seo' },
  DataForSeoBot: { company: 'dataforseo', purpose: 'seo' },
  'Screaming Frog': { company: 'screamingfrog', purpose: 'seo' },

  // Monitoring / infra
  UptimeRobot: { company: 'uptimerobot', purpose: 'monitoring' },
  Pingdom: { company: 'solarwinds', purpose: 'monitoring' },
  StatusCake: { company: 'statuscake', purpose: 'monitoring' },
  Vercel: { company: 'vercel', purpose: 'monitoring' },
};

export type BotAgentStat = {
  botName: string;
  purpose: BotPurpose;
  purposeLabel: string;
  count: number;
};

export type BotCompanyStat = {
  id: string;
  name: string;
  color: string;
  count: number;
  /** Percent of bot visits, 0–100. */
  share: number;
  /** True when the company runs a training or AI-answer crawler. */
  ai: boolean;
  agents: BotAgentStat[];
};

export function botCompany(botName: string | null | undefined): BotCompany {
  const profile = botName ? BOT_PROFILES[botName] : undefined;
  return BOT_COMPANIES[profile?.company ?? 'unknown'];
}

export function botPurpose(botName: string | null | undefined): BotPurpose {
  const profile = botName ? BOT_PROFILES[botName] : undefined;
  return profile?.purpose ?? 'other';
}

/** Company ids that operate at least one AI training or answer crawler. */
export function isAiCompany(companyId: string): boolean {
  return Object.values(BOT_PROFILES).some(
    (p) =>
      p.company === companyId &&
      (p.purpose === 'training' || p.purpose === 'ai-answers')
  );
}

/** Build a stat row for one crawler user agent. */
export function toBotAgentStat(botName: string, count: number): BotAgentStat {
  const purpose = botPurpose(botName);
  return { botName, purpose, purposeLabel: PURPOSE_LABEL[purpose], count };
}

function percent(count: number, of: number): number {
  if (of <= 0) return 0;
  return Math.round((count / of) * 1000) / 10;
}

/** Roll individual crawlers up to the company that operates them. */
export function rollUpBotCompanies(
  agents: BotAgentStat[],
  botTotal: number
): BotCompanyStat[] {
  const byCompany = new Map<string, BotCompanyStat>();

  for (const agent of agents) {
    const company = botCompany(agent.botName);
    const existing = byCompany.get(company.id);
    if (existing) {
      existing.count += agent.count;
      existing.agents.push(agent);
      continue;
    }
    byCompany.set(company.id, {
      id: company.id,
      name: company.name,
      color: company.color,
      count: agent.count,
      share: 0,
      ai: isAiCompany(company.id),
      agents: [agent],
    });
  }

  return [...byCompany.values()]
    .map((company) => ({
      ...company,
      share: percent(company.count, botTotal),
      agents: [...company.agents].sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);
}
