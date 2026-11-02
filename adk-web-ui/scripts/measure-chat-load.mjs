#!/usr/bin/env node
// Measures how long /chat?agent=<name> takes to become usable.
//
//   node scripts/measure-chat-load.mjs [baseUrl] [runs] [agent ...]
//   PROFILE=mobile node scripts/measure-chat-load.mjs   (4x CPU, ~9 Mbps / 150 ms RTT)
//
// Each run uses a fresh browser context (cold HTTP cache, no cookies), so the
// numbers are a first visit. Reported per agent as the median of the runs:
//   fcp       first contentful paint
//   composer  chat textarea present and enabled (the user can type and send)
//   agent     agent name rendered in the chat header
//   js        bytes of JavaScript transferred
//   api       each /api/* request: start → end, ms since navigation
import { chromium } from '@playwright/test';

const [baseUrl = 'https://agentdirectory.folch.ai', runsArg = '5', ...agentArgs] = process.argv.slice(2);
const runs = Number(runsArg);
const agents = agentArgs.length ? agentArgs : ['exa_mcp_agent', 'reddit_scout_agent'];
const mobile = process.env.PROFILE === 'mobile';

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null;
};

async function measureOnce(browser, agent) {
  const context = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
  );
  const page = await context.newPage();
  if (mobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (9 * 1024 * 1024) / 8,
      uploadThroughput: (1.5 * 1024 * 1024) / 8,
    });
  }

  const t0 = Date.now();
  const api = {};
  let jsBytes = 0;
  page.on('requestfinished', async (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/')) {
      const timing = req.timing();
      const key = url.pathname;
      api[key] ??= [];
      api[key].push([Math.round(timing.startTime - t0), Math.round(timing.startTime - t0 + timing.responseEnd)]);
    }
    if (req.resourceType() === 'script') {
      const sizes = await req.sizes().catch(() => null);
      if (sizes) jsBytes += sizes.responseBodySize;
    }
  });

  await page.goto(`${baseUrl}/chat?agent=${encodeURIComponent(agent)}`, { waitUntil: 'commit' });
  const composer = page
    .waitForSelector('textarea:not([disabled])', { timeout: 60000 })
    .then(() => Date.now() - t0)
    .catch(() => null);
  const header = page
    .waitForFunction(
      () => {
        const el = document.querySelector('header button[aria-label^="Agent:"]');
        return el && !el.getAttribute('aria-label').includes('Loading');
      },
      null,
      { timeout: 60000 },
    )
    .then(() => Date.now() - t0)
    .catch(() => null);
  const [composerMs, agentMs] = await Promise.all([composer, header]);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const fcp = await page.evaluate(
    () => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
  );
  await context.close();
  return { fcp, composer: composerMs, agent: agentMs, js: jsBytes, api };
}

const browser = await chromium.launch();
console.log(`${baseUrl} profile=${mobile ? 'mobile' : 'desktop'} runs=${runs}`);
for (const agent of agents) {
  const results = [];
  for (let i = 0; i < runs; i++) results.push(await measureOnce(browser, agent));
  const apiKeys = [...new Set(results.flatMap((r) => Object.keys(r.api)))];
  const apiSummary = apiKeys
    .map((k) => {
      const starts = median(results.map((r) => r.api[k]?.[0]?.[0]));
      const ends = median(results.map((r) => r.api[k]?.[0]?.[1]));
      const count = median(results.map((r) => r.api[k]?.length ?? 0));
      return `${k} ×${count} ${starts}→${ends}ms`;
    })
    .join(', ');
  console.log(
    `${agent}: fcp=${median(results.map((r) => r.fcp))}ms composer=${median(results.map((r) => r.composer))}ms ` +
      `agent=${median(results.map((r) => r.agent))}ms js=${Math.round(median(results.map((r) => r.js)) / 1024)}KB`,
  );
  console.log(`  raw composer: ${results.map((r) => r.composer).join(', ')}`);
  console.log(`  api: ${apiSummary}`);
}
await browser.close();
