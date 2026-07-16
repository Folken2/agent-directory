# Settings Shell (BYOK / MCP placeholders)

**Date:** 2026-07-16  
**Status:** Approved for planning  
**Scope:** Signed-in private settings IA with honest “coming soon” placeholders for BYOK and MCP/Gmail — no live key storage or OAuth connect.

## Problem

Home and product messaging promise richer signed-in experiences (BYOK, Gmail / MCP connections), but there is no private settings surface. Until keys and connections ship, CTAs need an honest place to land later, and signed-in users need a curated account area that does not pretend those features already work.

## Goals

- Ship a quiet, private settings shell under `/settings` with real sub-routes for later BYOK and connections work.
- Auth-gate all settings pages (signed-in only).
- Placeholders that clearly say **not available yet** — no fake live inputs or toggles.
- Discoverability via the signed-in nav cluster only (next to Sessions).
- Keep the home free-path / signup story unchanged in this pass.

## Non-goals

- Storing API keys, encrypting secrets, or BYOK runtime wiring.
- Gmail OAuth, MCP OAuth, or any real “Connect” flow.
- Billing, profiles beyond session identity, or chat soft-prompt changes.
- Home hero CTA changes (no new Settings CTA on `/`).
- Redesigning marketing pages or the chat shell.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Access | **A** — Signed-in only; anonymous → `/auth/signin?callbackUrl=…` |
| IA depth | **B** — `/settings` + `/settings/keys` + `/settings/connections` |
| Home CTAs | **A** — Unchanged; Settings only in nav auth cluster |
| Visual approach | Sessions-style quiet pages (`max-w-3xl`), not a dashboard |

## Design

### Routes

| Path | Content |
|------|---------|
| `/settings` | Overview: name/email from session; short “what settings will unlock”; links to Keys, Connections, and existing Sessions |
| `/settings/keys` | BYOK placeholder — explain bring-your-own keys; **Coming soon**; no fake key fields that look submittable |
| `/settings/connections` | MCP / Gmail placeholder — intended connections as disabled/plain rows or text; **Coming soon** |

`robots: { index: false, follow: false }` on all settings pages (account-private).

### Auth

Mirror `/me/sessions`:

```ts
const session = await auth();
if (!session?.user?.id) {
  redirect(`/auth/signin?callbackUrl=${encodeURIComponent(path)}`);
}
```

### Navigation

In `Navigation.tsx` signed-in cluster (desktop + mobile): add **Settings** → `/settings` next to **Sessions**. Do not add Settings to the primary marketing nav (Agents / Trending / …).

### Layout & UI

- Shared settings layout with a small section list: Overview · API keys · Connections.
- Match `/me/sessions` tone: `max-w-3xl`, `text-2xl` title, muted supporting copy, light borders — no hero, no feature-card grid, no glow.
- Overview may link to `/me/sessions` as “Your sessions” (existing page stays where it is).

### Copy principle

Prefer “Coming soon” / “Not available yet.” Never imply keys can be saved or Gmail/MCP can be connected today. Free open-source use remains on the home path without an account.

### Testing

- E2E (or request-level): anonymous `/settings` redirects to sign-in with callback.
- Signed-in (or mocked session): `/settings`, `/settings/keys`, `/settings/connections` render placeholder copy; nav shows Settings.

## Out of scope follow-ups

- Real BYOK persistence and agent runtime use.
- Real MCP / Gmail connect.
- Optional later: deep-link home upgrade copy to `/settings/keys` or `/settings/connections` once those are live.
