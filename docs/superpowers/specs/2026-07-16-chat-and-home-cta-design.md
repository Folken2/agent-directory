# Chat Experience + Home Signup CTA

**Date:** 2026-07-16  
**Status:** Approved for planning  
**Scope:** Dual-track polish — modern chat feel (same shell) + home-only signup CTA (messaging only)

## Problem

1. The chat UI still reads as a generic, dated assistant layout: bubble-heavy messages, noisy tool/thinking chrome, weak empty/composer hierarchy, and leftover header clutter.
2. Signup value is unclear. Auth today only soft-sells history and rate limits. There is no clear home CTA explaining that signing in unlocks richer agent experiences (BYOK, Gmail / MCP connections), while free open-source use remains available without an account.

## Goals

- Make the home page the clear place where anonymous users understand **free agents now** vs **sign in for more**.
- Modernize the chat *feel* (message rhythm, streaming, tools/thinking, composer, empty state, header) without changing the overall shell.
- Stay honest: BYOK / Gmail / MCP are **promised capabilities**, not shipping settings in this pass.

## Non-goals

- Building BYOK settings, Gmail OAuth connect, or user MCP connection UI.
- Redesigning the chat shell (no new agent picker, no new right-rail product model).
- Pushing signup CTAs inside chat (home owns that story).
- Changing nav, auth providers, rate-limit numbers, or session persistence behavior.
- Marketing-site rewrite beyond the home hero dual-path.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Signup product depth | Messaging + CTA only |
| Chat depth | Modern product feel; same shell |
| CTA placement | Home only |
| Existing chat sign-in prompts | Keep as-is (history / limits) |

## Design

### 1. Home — dual-path hero

**Surface:** `adk-web-ui/app/page.tsx` (plus small presentational pieces if needed).

**Composition (one hero, not a dashboard):**

1. **Headline** — discovery-focused (agent directory), sharper than current copy.
2. **Supporting line** — free & open source; try agents now; sign in unlocks more.
3. **Primary CTA pair:**
   - **Try free agents** → scroll to `#agents-section` (current browse behavior).
   - **Sign in for more** → `/auth/signin` (existing Google OAuth).
4. **Upgrade explainer** — directly under CTAs, inline (not a feature-card grid). States that signed-in users get access to:
   - BYOK (bring your own keys)
   - Connect Gmail and other MCPs for richer agent experiences
   - (Also true today, may be mentioned lightly) higher limits + saved history
5. **Secondary link** — View Repository as quiet text/ghost; must not compete with the two primary CTAs.
6. **Signed-in state** — replace “Sign in for more” with a secondary CTA **Your sessions** → `/me/sessions` (no signup nag).

**Copy principle:** Describe unlocks without implying settings pages or connect flows already exist. Prefer “Sign in for more” / “unlock” language over “Connect Gmail now.”

### 2. Chat — modern product feel (same shell)

**Keep:** Left history sidebar · center thread · sticky composer · optional agent-details panel · existing soft “sign in for history / limits” copy (including rate-limit banner).

**Upgrade:**

| Area | Direction |
|------|-----------|
| Message rhythm | Less bubble-app; calmer thread — tighter content width, better spacing, softer user treatment, assistant as clean prose |
| Streaming | Stable in-flight layout; no jump when tools/thinking appear; send → stop feels immediate |
| Tools / thinking / sub-agents | Compact by default; expand for detail; thinking as quiet secondary block |
| Composer | Clearer focus, attach/send hierarchy, better disabled/rate-limit states; keep attach + stop |
| Empty state | Warm agent-aware greeting + sample prompts; **no** BYOK/MCP signup pitch |
| Header | Agent name + essential actions; remove dated “Powered by Gemini…” clutter |
| Motion | 2–3 subtle motions (message enter, tool appear, composer focus) |

**Primary files (expected):**  
`MessageBubble`, `StreamingBubble`, `MessageList`, `Composer`, `EmptyState`, chat header in `app/chat/page.tsx`, and tool/thinking/sub-agent presentation components.

**Leave alone unless a tiny polish fix requires it:** `useStreamingChat` and store/schema. No new routes.

### 3. Auth & free path

- Anonymous users can still browse agents and chat within existing limits.
- Sign-in remains Google OAuth via `/auth/signin`.
- Chat continues to mention history/limits only; home carries the BYOK/MCP story.

## Architecture notes

- Frontend-only UI/copy changes in `adk-web-ui`.
- Reuse existing `SessionProvider` / NextAuth session for home CTA swap.
- No backend, DB, or ADK agent changes in this pass.

## Verification

- **Home (signed out):** Dual CTAs visible; upgrade explainer present; Browse scrolls to agents; Sign in routes to auth.
- **Home (signed in):** No signup nag; alternative CTA/state shown.
- **Chat:** Streaming + tools/thinking cleaner; empty state; composer send/stop; mobile usable; existing history/limits prompts unchanged.
- No new automated e2e suite required; smoke-check these surfaces.

## Success criteria

- A first-time visitor understands they can use free agents without an account **and** why signing in matters (BYOK / connections / better experiences).
- Chat no longer feels like a generic 2023 bubble UI; hierarchy and tool presentation feel current.
- No false claims that BYOK or MCP connect UIs are live.
