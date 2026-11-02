#!/usr/bin/env node
// Measures how long /chat?agent=<name> takes to become usable.
//
//   node scripts/measure-chat-load.mjs [baseUrl] [runs] [agent ...]
//   PROFILE=mobile node scripts/measure-chat-load.mjs   (4x CPU, ~9 Mbps / 150 ms RTT)
//   API_ORIGIN=https://agentdirectory.folch.ai node scripts/measure-chat-load.mjs http://localhost:3000
//     serves pages and JS from a local build but sends /api/* GETs to API_ORIGIN, so two
//     local builds can be compared against the real backend.
//
// Each run uses a fresh browser context (cold HTTP cache, no cookies), so the
// numbers are a first visit. Reported per agent as the median of the runs:
//   fp        first paint (the skeleton)
//   fcp       first contentful paint (first text or image)
//   composer  chat textarea present and enabled (the user can type and send)
//   agent     agent name rendered in the chat header
//   js        bytes of JavaScript transferred
//   api       each /api/* request: start → end, ms since navigation
import { chromium } from '@playwright/test';

const [baseUrl = 'https://agentdirectory.folch.ai', runsArg = '5', ...agentArgs] = process.argv.slice(2);
const runs = Number(runsArg);
const agents = agentArgs.length ? agentArgs : ['exa_mcp_agent', 'reddit_scout_agent'];
const mobile = process.env.PROFILE === 'mobile';
const apiOrigin = process.env.API_ORIGIN;

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

  if (apiOrigin) {
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      // Don't record measurement visits in the real analytics.
      if (route.request().method() !== 'GET') return route.fulfill({ status: 204 });
      const response = await route.fetch({ url: apiOrigin + url.pathname + url.search });
      await route.fulfill({ response });
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

  // Checked every frame in the page, so the times are paint-accurate (Playwright's
  // own selector polling adds up to a few hundred ms under CPU throttling).
  await page.addInitScript(() => {
    window.__ready = {};
    const tick = () => {
      const ta = document.querySelector('textarea');
      if (!window.__ready.composer && ta && !ta.disabled) window.__ready.composer = performance.now();
      const h = document.querySelector('header button[aria-label^="Agent:"]');
      if (!window.__ready.agent && h && !h.getAttribute('aria-label').includes('Loading')) window.__ready.agent = performance.now();
      if (!(window.__ready.composer && window.__ready.agent) && performance.now() < 60000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto(`${baseUrl}/chat?agent=${encodeURIComponent(agent)}`, { waitUntil: 'commit' });
  await page
    .waitForFunction(() => window.__ready?.composer && window.__ready?.agent, null, { timeout: 60000, polling: 100 })
    .catch(() => {});
  const { composer: composerMs = null, agent: agentMs = null } = await page.evaluate(() => window.__ready ?? {});
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const [fp, fcp] = await page.evaluate(() =>
    ['first-paint', 'first-contentful-paint'].map((n) => performance.getEntriesByName(n)[0]?.startTime ?? null),
  );
  await context.close();
  return { fp, fcp, composer: composerMs, agent: agentMs, js: jsBytes, api };
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
    `${agent}: fp=${median(results.map((r) => r.fp))}ms fcp=${median(results.map((r) => r.fcp))}ms composer=${median(results.map((r) => r.composer))}ms ` +
      `agent=${median(results.map((r) => r.agent))}ms js=${Math.round(median(results.map((r) => r.js)) / 1024)}KB`,
  );
  console.log(`  raw composer: ${results.map((r) => r.composer).join(', ')}`);
  console.log(`  api: ${apiSummary}`);
}
await browser.close();
