/**
 * Maps a detected crawler to the company that operates it and to what the
 * crawl is for. Bot names come from `identifyBot`.
 *
 * Operator attribution follows the publisher of the crawler (Cloudflare AI
 * Crawl Control bot reference + each vendor’s published UA docs) — not the
 * conglomerate parent when that would mislabel the brand (e.g. Slackbot →
 * Slack, LinkedInBot → LinkedIn, Bingbot → Microsoft).
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
  /** Brand colour, used for the row accent. */
  color: string;
  /** Canonical site used to resolve the real brand favicon. */
  domain: string | null;
};

export const BOT_COMPANIES = {
  anthropic: { id: 'anthropic', name: 'Anthropic', color: '#D97757', domain: 'anthropic.com' },
  openai: { id: 'openai', name: 'OpenAI', color: '#0F0F0F', domain: 'openai.com' },
  google: { id: 'google', name: 'Google', color: '#4285F4', domain: 'google.com' },
  meta: { id: 'meta', name: 'Meta', color: '#0866FF', domain: 'meta.com' },
  microsoft: { id: 'microsoft', name: 'Microsoft', color: '#00A4EF', domain: 'microsoft.com' },
  apple: { id: 'apple', name: 'Apple', color: '#1D1D1F', domain: 'apple.com' },
  amazon: { id: 'amazon', name: 'Amazon', color: '#FF9900', domain: 'amazon.com' },
  bytedance: { id: 'bytedance', name: 'ByteDance', color: '#FE2C55', domain: 'bytedance.com' },
  perplexity: { id: 'perplexity', name: 'Perplexity', color: '#20808D', domain: 'perplexity.ai' },
  commoncrawl: { id: 'commoncrawl', name: 'Common Crawl', color: '#3B6EA5', domain: 'commoncrawl.org' },
  cohere: { id: 'cohere', name: 'Cohere', color: '#39594D', domain: 'cohere.com' },
  diffbot: { id: 'diffbot', name: 'Diffbot', color: '#2B6CB0', domain: 'diffbot.com' },
  you: { id: 'you', name: 'You.com', color: '#6C5CE7', domain: 'you.com' },
  mistral: { id: 'mistral', name: 'Mistral', color: '#FF7000', domain: 'mistral.ai' },
  deepseek: { id: 'deepseek', name: 'DeepSeek', color: '#4D6BFE', domain: 'deepseek.com' },
  yandex: { id: 'yandex', name: 'Yandex', color: '#FC3F1D', domain: 'yandex.com' },
  baidu: { id: 'baidu', name: 'Baidu', color: '#2932E1', domain: 'baidu.com' },
  duckduckgo: { id: 'duckduckgo', name: 'DuckDuckGo', color: '#DE5833', domain: 'duckduckgo.com' },
  yahoo: { id: 'yahoo', name: 'Yahoo', color: '#6001D2', domain: 'yahoo.com' },
  seznam: { id: 'seznam', name: 'Seznam', color: '#CC0000', domain: 'seznam.cz' },
  huawei: { id: 'huawei', name: 'Huawei', color: '#CF0A2C', domain: 'huawei.com' },
  linkedin: { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', domain: 'linkedin.com' },
  slack: { id: 'slack', name: 'Slack', color: '#4A154B', domain: 'slack.com' },
  x: { id: 'x', name: 'X', color: '#0F0F0F', domain: 'x.com' },
  discord: { id: 'discord', name: 'Discord', color: '#5865F2', domain: 'discord.com' },
  telegram: { id: 'telegram', name: 'Telegram', color: '#26A5E4', domain: 'telegram.org' },
  ahrefs: { id: 'ahrefs', name: 'Ahrefs', color: '#FF8C00', domain: 'ahrefs.com' },
  semrush: { id: 'semrush', name: 'Semrush', color: '#FF642D', domain: 'semrush.com' },
  seranking: { id: 'seranking', name: 'SE Ranking', color: '#1E88E5', domain: 'seranking.com' },
  moz: { id: 'moz', name: 'Moz', color: '#0EA5E9', domain: 'moz.com' },
  majestic: { id: 'majestic', name: 'Majestic', color: '#7C3AED', domain: 'majestic.com' },
  dataforseo: { id: 'dataforseo', name: 'DataForSEO', color: '#1E88E5', domain: 'dataforseo.com' },
  screamingfrog: { id: 'screamingfrog', name: 'Screaming Frog', color: '#22A45D', domain: 'screamingfrog.co.uk' },
  metacrawler: { id: 'metacrawler', name: 'MetaCrawler', color: '#0F766E', domain: 'metacrawler.com' },
  uptimerobot: { id: 'uptimerobot', name: 'UptimeRobot', color: '#3BD671', domain: 'uptimerobot.com' },
  pingdom: { id: 'pingdom', name: 'Pingdom', color: '#FF4E00', domain: 'pingdom.com' },
  statuscake: { id: 'statuscake', name: 'StatusCake', color: '#1BA0E1', domain: 'statuscake.com' },
  vercel: { id: 'vercel', name: 'Vercel', color: '#0F0F0F', domain: 'vercel.com' },
  unknown: { id: 'unknown', name: 'Unidentified', color: '#94A3B8', domain: null },
} as const satisfies Record<string, BotCompany>;

export type BotCompanyId = keyof typeof BOT_COMPANIES;

type BotProfile = { company: BotCompanyId; purpose: BotPurpose };

/**
 * Exact `identifyBot` names → operator + purpose.
 * Sources: Cloudflare AI Crawl Control bot reference; OpenAI / Anthropic /
 * Perplexity / Meta / Google published crawler docs.
 */
const BOT_PROFILES: Record<string, BotProfile> = {
  // OpenAI — https://developers.openai.com/api/docs/bots
  GPTBot: { company: 'openai', purpose: 'training' },
  'ChatGPT-User': { company: 'openai', purpose: 'ai-answers' },
  'OAI-SearchBot': { company: 'openai', purpose: 'indexing' },

  // Anthropic — ClaudeBot / Claude-User / Claude-SearchBot
  ClaudeBot: { company: 'anthropic', purpose: 'training' },
  'Claude-User': { company: 'anthropic', purpose: 'ai-answers' },
  'Claude-SearchBot': { company: 'anthropic', purpose: 'indexing' },

  // Other AI labs — Cloudflare AI Crawl Control
  PerplexityBot: { company: 'perplexity', purpose: 'ai-answers' },
  'Perplexity-User': { company: 'perplexity', purpose: 'ai-answers' },
  'Google-Extended': { company: 'google', purpose: 'training' },
  'Google-CloudVertexBot': { company: 'google', purpose: 'training' },
  Amazonbot: { company: 'amazon', purpose: 'training' },
  Bytespider: { company: 'bytedance', purpose: 'training' },
  CCBot: { company: 'commoncrawl', purpose: 'training' },
  'cohere-ai': { company: 'cohere', purpose: 'training' },
  Diffbot: { company: 'diffbot', purpose: 'training' },
  YouBot: { company: 'you', purpose: 'ai-answers' },
  'MistralAI-User': { company: 'mistral', purpose: 'ai-answers' },
  DeepSeekBot: { company: 'deepseek', purpose: 'training' },
  'meta-externalagent': { company: 'meta', purpose: 'training' },
  'meta-externalfetcher': { company: 'meta', purpose: 'ai-answers' },
  FacebookBot: { company: 'meta', purpose: 'training' },
  MetaCrawler: { company: 'metacrawler', purpose: 'indexing' },

  // Search indexing
  Googlebot: { company: 'google', purpose: 'indexing' },
  Bingbot: { company: 'microsoft', purpose: 'indexing' },
  DuckDuckBot: { company: 'duckduckgo', purpose: 'indexing' },
  DuckAssistBot: { company: 'duckduckgo', purpose: 'ai-answers' },
  YandexBot: { company: 'yandex', purpose: 'indexing' },
  Baiduspider: { company: 'baidu', purpose: 'indexing' },
  SeznamBot: { company: 'seznam', purpose: 'indexing' },
  Applebot: { company: 'apple', purpose: 'indexing' },
  'Applebot-Extended': { company: 'apple', purpose: 'training' },
  PetalBot: { company: 'huawei', purpose: 'indexing' },
  Slurp: { company: 'yahoo', purpose: 'indexing' },

  // Link previews / social — operator brand, not conglomerate parent
  facebookexternalhit: { company: 'meta', purpose: 'preview' },
  WhatsApp: { company: 'meta', purpose: 'preview' },
  Twitterbot: { company: 'x', purpose: 'preview' },
  LinkedInBot: { company: 'linkedin', purpose: 'preview' },
  Discordbot: { company: 'discord', purpose: 'preview' },
  TelegramBot: { company: 'telegram', purpose: 'preview' },
  Slackbot: { company: 'slack', purpose: 'preview' },

  // SEO tooling
  AhrefsBot: { company: 'ahrefs', purpose: 'seo' },
  SemrushBot: { company: 'semrush', purpose: 'seo' },
  SERankingBacklinksBot: { company: 'seranking', purpose: 'seo' },
  DotBot: { company: 'moz', purpose: 'seo' },
  MJ12bot: { company: 'majestic', purpose: 'seo' },
  DataForSeoBot: { company: 'dataforseo', purpose: 'seo' },
  'Screaming Frog': { company: 'screamingfrog', purpose: 'seo' },

  // Monitoring / infra
  UptimeRobot: { company: 'uptimerobot', purpose: 'monitoring' },
  Pingdom: { company: 'pingdom', purpose: 'monitoring' },
  StatusCake: { company: 'statuscake', purpose: 'monitoring' },
  Vercel: { company: 'vercel', purpose: 'monitoring' },
};

/** Real brand favicon (PNG) for a company domain — no hand-drawn SVG marks. */
export function brandIconUrl(domain: string | null | undefined, size = 64): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

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
  domain: string | null;
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
      domain: company.domain,
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
