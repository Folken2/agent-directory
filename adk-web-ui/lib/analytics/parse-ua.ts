export type ParsedUa = {
  browser: string | null;
  os: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
};

/**
 * Lightweight UA parsing — good enough for aggregates, no extra dependency.
 */
export function parseUserAgent(
  userAgent: string | null | undefined,
  isBot: boolean
): ParsedUa {
  if (!userAgent) {
    return { browser: null, os: null, deviceType: isBot ? 'bot' : 'unknown' };
  }

  if (isBot) {
    return { browser: null, os: null, deviceType: 'bot' };
  }

  const ua = userAgent;
  let browser: string | null = null;
  let os: string | null = null;

  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/MSIE |Trident\//i.test(ua)) browser = 'IE';

  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  let deviceType: ParsedUa['deviceType'] = 'desktop';
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) deviceType = 'tablet';
  else if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(ua)) deviceType = 'mobile';

  return { browser, os, deviceType };
}
