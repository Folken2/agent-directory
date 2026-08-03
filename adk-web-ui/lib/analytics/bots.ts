export type BotCategory =
  | 'ai'
  | 'search'
  | 'social'
  | 'seo'
  | 'monitoring'
  | 'other';

export type BotConfidence = 'high' | 'medium' | 'low';

export type BotMatch = {
  isBot: boolean;
  botName: string | null;
  botCategory: BotCategory | null;
  confidence: BotConfidence | null;
  signals: string[];
};

type BotRule = {
  name: string;
  category: BotCategory;
  patterns: string[];
};

const BOT_RULES: BotRule[] = [
  // OpenAI — https://developers.openai.com/api/docs/bots
  { name: 'GPTBot', category: 'ai', patterns: ['GPTBot'] },
  { name: 'ChatGPT-User', category: 'ai', patterns: ['ChatGPT-User'] },
  { name: 'OAI-SearchBot', category: 'ai', patterns: ['OAI-SearchBot'] },
  // Anthropic — ClaudeBot / Claude-User / Claude-SearchBot
  { name: 'ClaudeBot', category: 'ai', patterns: ['ClaudeBot', 'anthropic-ai', 'Claude-Web'] },
  { name: 'Claude-User', category: 'ai', patterns: ['Claude-User'] },
  { name: 'Claude-SearchBot', category: 'ai', patterns: ['Claude-SearchBot'] },
  // Other AI operators — Cloudflare AI Crawl Control bot reference
  { name: 'PerplexityBot', category: 'ai', patterns: ['PerplexityBot'] },
  { name: 'Perplexity-User', category: 'ai', patterns: ['Perplexity-User'] },
  { name: 'Google-Extended', category: 'ai', patterns: ['Google-Extended'] },
  { name: 'Google-CloudVertexBot', category: 'ai', patterns: ['Google-CloudVertexBot'] },
  { name: 'Amazonbot', category: 'ai', patterns: ['Amazonbot'] },
  { name: 'Bytespider', category: 'ai', patterns: ['Bytespider'] },
  { name: 'CCBot', category: 'ai', patterns: ['CCBot'] },
  { name: 'cohere-ai', category: 'ai', patterns: ['cohere-ai'] },
  { name: 'Diffbot', category: 'ai', patterns: ['Diffbot'] },
  { name: 'YouBot', category: 'ai', patterns: ['YouBot'] },
  { name: 'MistralAI-User', category: 'ai', patterns: ['MistralAI-User'] },
  { name: 'DeepSeekBot', category: 'ai', patterns: ['DeepSeekBot'] },
  { name: 'meta-externalagent', category: 'ai', patterns: ['meta-externalagent'] },
  { name: 'meta-externalfetcher', category: 'ai', patterns: ['meta-externalfetcher'] },
  { name: 'FacebookBot', category: 'ai', patterns: ['FacebookBot'] },
  { name: 'MetaCrawler', category: 'ai', patterns: ['MetaCrawler'] },

  { name: 'Googlebot', category: 'search', patterns: ['Googlebot', 'Googlebot-Image', 'Googlebot-News', 'Storebot-Google', 'AdsBot-Google', 'Mediapartners-Google'] },
  { name: 'Bingbot', category: 'search', patterns: ['bingbot', 'BingPreview', 'adidxbot'] },
  { name: 'DuckDuckBot', category: 'search', patterns: ['DuckDuckBot'] },
  { name: 'DuckAssistBot', category: 'ai', patterns: ['DuckAssistBot'] },
  { name: 'YandexBot', category: 'search', patterns: ['YandexBot', 'YandexImages'] },
  { name: 'Baiduspider', category: 'search', patterns: ['Baiduspider'] },
  { name: 'SeznamBot', category: 'search', patterns: ['SeznamBot'] },
  // Applebot-Extended before Applebot so the more specific UA wins
  { name: 'Applebot-Extended', category: 'ai', patterns: ['Applebot-Extended'] },
  { name: 'Applebot', category: 'search', patterns: ['Applebot'] },
  { name: 'PetalBot', category: 'search', patterns: ['PetalBot'] },
  { name: 'Slurp', category: 'search', patterns: ['Slurp'] },

  { name: 'facebookexternalhit', category: 'social', patterns: ['facebookexternalhit', 'Facebot'] },
  { name: 'Twitterbot', category: 'social', patterns: ['Twitterbot'] },
  { name: 'LinkedInBot', category: 'social', patterns: ['LinkedInBot'] },
  { name: 'Discordbot', category: 'social', patterns: ['Discordbot'] },
  { name: 'TelegramBot', category: 'social', patterns: ['TelegramBot'] },
  { name: 'Slackbot', category: 'social', patterns: ['Slackbot', 'Slack-ImgProxy'] },
  { name: 'WhatsApp', category: 'social', patterns: ['WhatsApp'] },

  { name: 'AhrefsBot', category: 'seo', patterns: ['AhrefsBot'] },
  { name: 'SemrushBot', category: 'seo', patterns: ['SemrushBot'] },
  { name: 'SERankingBacklinksBot', category: 'seo', patterns: ['SERankingBacklinksBot'] },
  { name: 'DotBot', category: 'seo', patterns: ['DotBot'] },
  { name: 'MJ12bot', category: 'seo', patterns: ['MJ12bot'] },
  { name: 'DataForSeoBot', category: 'seo', patterns: ['DataForSeoBot'] },
  { name: 'Screaming Frog', category: 'seo', patterns: ['Screaming Frog'] },

  { name: 'UptimeRobot', category: 'monitoring', patterns: ['UptimeRobot'] },
  { name: 'Pingdom', category: 'monitoring', patterns: ['Pingdom'] },
  { name: 'StatusCake', category: 'monitoring', patterns: ['StatusCake'] },
  { name: 'Vercel', category: 'monitoring', patterns: ['vercel-favicon', 'Vercel Edge Functions'] },
];

const GENERIC_BOT_PATTERN =
  /\b(bot|crawler|spider|crawl|slurp|fetcher|preview|monitor|headless|phantomjs|selenium)\b/i;

/**
 * Pull a readable crawler token from a UA when we only know it's "some bot".
 * Avoids dumping everything into a useless UnknownBot bucket.
 */
export function extractBotTokenFromUa(userAgent: string): string | null {
  const ua = userAgent.trim();
  if (!ua) return null;

  const compact = ua.match(
    /\b([A-Za-z][\w.-]*(?:bot|crawler|spider|slurp|fetcher)[\w.-]*)\b/i
  );
  if (compact?.[1]) return compact[1];

  const spaced = ua.match(
    /\b([A-Za-z][\w.-]+)\s+(crawler|spider|bot|slurp|fetcher)\b/i
  );
  if (spaced) return `${spaced[1]}-${spaced[2]}`;

  return null;
}

/** Re-label stored UnknownBot / null using the original user-agent. */
export function resolveStoredBotName(
  stored: string | null | undefined,
  userAgent: string | null | undefined
): string {
  if (stored && stored !== 'UnknownBot' && stored !== 'Probe') return stored;
  if (!userAgent?.trim()) return 'UnknownBot';

  // Re-run rules in case the catalog gained a match after the row was written.
  for (const rule of BOT_RULES) {
    for (const pattern of rule.patterns) {
      if (userAgent.includes(pattern)) return rule.name;
    }
  }

  return extractBotTokenFromUa(userAgent) ?? 'UnknownBot';
}

export type IdentifyBotOptions = {
  /** Accept-Language header value */
  language?: string | null;
  /** Request source channel */
  source?: 'server' | 'client';
  headers?: Headers | null;
};

function collectSoftSignals(
  userAgent: string | null | undefined,
  options?: IdentifyBotOptions
): string[] {
  const signals: string[] = [];
  const ua = userAgent?.trim() ?? '';

  if (!ua) signals.push('empty_ua');
  if (/HeadlessChrome|PhantomJS|Selenium|Puppeteer|Playwright/i.test(ua)) {
    signals.push('automation_ua');
  }

  const language = options?.language ?? options?.headers?.get('accept-language');
  if (options?.source === 'server' && (!language || !language.trim())) {
    signals.push('missing_accept_language');
  }

  const headers = options?.headers;
  if (headers && options?.source === 'server') {
    const dest = headers.get('sec-fetch-dest');
    const mode = headers.get('sec-fetch-mode');
    // Real browsers usually send Sec-Fetch-* on navigations; many crawlers omit them.
    if (!dest && !mode && !headers.get('sec-fetch-site')) {
      signals.push('missing_sec_fetch');
    }
  }

  return signals;
}

/**
 * Identify bots from User-Agent (primary) plus soft request signals (secondary).
 * Soft signals alone require ≥2 hits before we mark as bot (medium confidence).
 */
export function identifyBot(
  userAgent: string | null | undefined,
  options?: IdentifyBotOptions
): BotMatch {
  const softSignals = collectSoftSignals(userAgent, options);

  if (userAgent?.trim()) {
    for (const rule of BOT_RULES) {
      for (const pattern of rule.patterns) {
        if (userAgent.includes(pattern)) {
          return {
            isBot: true,
            botName: rule.name,
            botCategory: rule.category,
            confidence: 'high',
            signals: ['ua_rule', ...softSignals],
          };
        }
      }
    }

    if (GENERIC_BOT_PATTERN.test(userAgent)) {
      return {
        isBot: true,
        botName: extractBotTokenFromUa(userAgent) ?? 'UnknownBot',
        botCategory: 'other',
        confidence: 'medium',
        signals: ['ua_generic', ...softSignals],
      };
    }
  }

  if (softSignals.length >= 2) {
    return {
      isBot: true,
      botName: userAgent?.trim()
        ? extractBotTokenFromUa(userAgent) ?? 'UnknownBot'
        : 'UnknownBot',
      botCategory: 'other',
      confidence: 'medium',
      signals: softSignals,
    };
  }

  if (softSignals.length === 1) {
    return {
      isBot: false,
      botName: null,
      botCategory: null,
      confidence: 'low',
      signals: softSignals,
    };
  }

  return {
    isBot: false,
    botName: null,
    botCategory: null,
    confidence: null,
    signals: [],
  };
}
