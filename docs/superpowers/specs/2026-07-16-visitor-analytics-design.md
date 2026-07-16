# Visitor Analytics Design (internal)

Date: 2026-07-16

## Goal

Store rich pageview events in Neon for later homepage stats and a country/bot breakdown page. No public UI in this slice.

## Decisions

- Granularity: one row per pageview
- Privacy: hashed IP (HMAC), anonymous `ad_vid` cookie, Vercel geo; no raw IP
- Bots: store and label known crawlers (OpenAI, Google, etc.)
- Signed-in: attach `user_id` when available
- Ingest: hybrid server (middleware document/bot hits) + client beacon (soft navigations)
- Dedupe: same `visitor_id + path` within 5 seconds

## Schema

`page_views` — see `adk-web-ui/lib/drizzle/schema/page-views.ts`

## Deploy / Neon

- Vercel already has `DATABASE_URL`; it does **not** auto-migrate by itself.
- `npm run build` runs `scripts/migrate-if-database.mjs` so deploys apply pending Drizzle migrations when `DATABASE_URL` is real.
- All visits stay in `page_views` (no retention/rollup for now).

## Out of scope

Cookie consent banner, Vercel Analytics export.
