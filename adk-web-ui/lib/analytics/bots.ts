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
  { name: 'GPTBot', category: 'ai', patterns: ['GPTBot'] },
  { name: 'ChatGPT-User', category: 'ai', patterns: ['ChatGPT-User'] },
  { name: 'OAI-SearchBot', category: 'ai', patterns: ['OAI-SearchBot'] },
  { name: 'ClaudeBot', category: 'ai', patterns: ['ClaudeBot', 'anthropic-ai', 'Claude-Web'] },
  { name: 'PerplexityBot', category: 'ai', patterns: ['PerplexityBot'] },
  { name: 'Google-Extended', category: 'ai', patterns: ['Google-Extended'] },
  { name: 'Amazonbot', category: 'ai', patterns: ['Amazonbot'] },
  { name: 'Bytespider', category: 'ai', patterns: ['Bytespider'] },
  { name: 'CCBot', category: 'ai', patterns: ['CCBot'] },
  { name: 'cohere-ai', category: 'ai', patterns: ['cohere-ai'] },
  { name: 'Diffbot', category: 'ai', patterns: ['Diffbot'] },
  { name: 'YouBot', category: 'ai', patterns: ['YouBot'] },
  { name: 'meta-externalagent', category: 'ai', patterns: ['meta-externalagent', 'FacebookBot'] },

  { name: 'Googlebot', category: 'search', patterns: ['Googlebot', 'Googlebot-Image', 'Googlebot-News', 'Storebot-Google', 'AdsBot-Google', 'Mediapartners-Google'] },
  { name: 'Bingbot', category: 'search', patterns: ['bingbot', 'BingPreview', 'adidxbot'] },
  { name: 'DuckDuckBot', category: 'search', patterns: ['DuckDuckBot'] },
  { name: 'YandexBot', category: 'search', patterns: ['YandexBot', 'YandexImages'] },
  { name: 'Baiduspider', category: 'search', patterns: ['Baiduspider'] },
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
        botName: 'UnknownBot',
        botCategory: 'other',
        confidence: 'medium',
        signals: ['ua_generic', ...softSignals],
      };
    }
  }

  if (softSignals.length >= 2) {
    return {
      isBot: true,
      botName: 'UnknownBot',
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
