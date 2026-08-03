# Consent, GA4 Hook & Engagement Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** EU-ready consent banner; cookieless visit counts always; after Accept — `ad_vid`, active-use engagement, optional GA4.

**Architecture:** `ad_consent` cookie gates persistent ID + marketing tags. Neon `engagement_events` for agent active use. GA4 script only when Measurement ID present, Consent Mode v2.

**Tech Stack:** Next.js App Router, Drizzle/Neon, gtag.js, first-party cookies

## Global Constraints

- Do not run `drizzle-kit migrate` on Vercel build; use runtime ensure-schema
- Folken2 for GitHub
- No secrets in repo; `NEXT_PUBLIC_GA_MEASUREMENT_ID` optional
- Preserve always-on aggregate pageviews for EU users without personal cookies

---

### Task 1: Consent primitives + tests

**Files:**
- Create `adk-web-ui/lib/analytics/consent.ts`
- Create `adk-web-ui/lib/analytics/consent.test.ts`
- Extend `adk-web-ui/lib/analytics/visitor-cookie.ts` with consent cookie helpers

- [ ] Types: `ConsentLevel = 'essential' | 'all'`
- [ ] Cookie name `ad_consent`, parse/serialize helpers
- [ ] Unit tests for parse defaults

### Task 2: Gate `ad_vid` on consent

**Files:**
- Modify `middleware.ts`, `pageview/route.ts`, `PageViewTracker.tsx`

- [ ] Middleware: set `ad_vid` only if consent=`all`; always record pageview with ephemeral id otherwise
- [ ] Pageview API: never set `ad_vid` unless consent=`all`
- [ ] Client tracker: still beacons; server decides cookie

### Task 3: Consent banner + privacy page

**Files:**
- Create `CookieConsentBanner.tsx`
- Create `app/privacy/page.tsx`
- Mount banner in `layout.tsx`
- Gate `<Analytics />` (Vercel) on consent

### Task 4: GA4 Consent Mode hook

**Files:**
- Create `GoogleAnalytics.tsx`
- `env.example` add `NEXT_PUBLIC_GA_MEASUREMENT_ID`

### Task 5: Engagement schema + API

**Files:**
- `lib/drizzle/schema/engagement-events.ts`
- `ensure-engagement-schema.ts` / extend ensure-schema
- `record-engagement.ts`, `POST /api/analytics/engagement`
- Client `trackEngagement` helper (consent-gated)

### Task 6: Instrument chat active use

**Files:**
- Hook in `useStreamingChat.send` (message_sent, tool_call)
- Chat dwell heartbeat in `ChatInterface` or small `AgentEngagementTracker`

### Task 7: `/analytics` top agents

**Files:**
- Extend `stats.ts` + `AnalyticsPreview` with top agents by messages / active time

### Task 8: Verify + commit

- [ ] `npm run test:unit`
- [ ] Commit on `feature/consent-ga-engagement`
