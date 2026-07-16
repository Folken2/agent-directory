# Chat Experience + Home Signup CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a home dual-path signup CTA (messaging only for BYOK/MCP) and a modern chat feel without changing the chat shell.

**Architecture:** Frontend-only changes in `adk-web-ui`. Home uses existing NextAuth `useSession` to swap CTAs. Chat polish touches presentational components only (`MessageBubble`, `StreamingBubble`, `MessageList`, `Composer`, `EmptyState`, `ThinkingBlock`, `ToolStatusDisplay`, chat header). No new routes, no BYOK/MCP settings, no streaming-hook changes unless a tiny stop-button fix is required.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Framer Motion, NextAuth v5 (`useSession`), Playwright e2e (`adk-web-ui/e2e`).

## Global Constraints

- Signup product depth: messaging + CTA only — do not build BYOK settings, Gmail connect, or user MCP UI.
- CTA placement: home only — do not add BYOK/MCP signup pitches inside chat.
- Chat shell unchanged: keep sidebar + thread + sticky composer + optional agent-details panel.
- Existing chat sign-in prompts stay as-is (history / limits / rate-limit banner).
- Copy must not imply connect/settings flows already exist; prefer “unlock” / “Sign in for more”.
- Free path always works: browse → chat without account.
- Spec: `docs/superpowers/specs/2026-07-16-chat-and-home-cta-design.md`.

---

## File map

| File | Responsibility |
|------|----------------|
| `adk-web-ui/app/page.tsx` | Dual-path hero, upgrade explainer, auth-aware CTA |
| `adk-web-ui/e2e/home-cta.spec.ts` | Playwright coverage for home CTAs (signed-out) |
| `adk-web-ui/app/chat/page.tsx` | Header cleanup (remove Gemini subtitle clutter) |
| `adk-web-ui/components/chat/EmptyState.tsx` | Empty-state polish; remove Gemini line; no signup pitch |
| `adk-web-ui/components/chat/MessageBubble.tsx` | Calmer message rhythm |
| `adk-web-ui/components/chat/StreamingBubble.tsx` | Match message rhythm + stable streaming layout |
| `adk-web-ui/components/chat/MessageList.tsx` | Thread width/spacing hierarchy |
| `adk-web-ui/components/ThinkingBlock.tsx` | Quieter collapsed thinking |
| `adk-web-ui/components/ToolStatusDisplay.tsx` | Compact tools-by-default presentation |
| `adk-web-ui/components/chat/Composer.tsx` | Focus/hierarchy polish |

---

### Task 1: Home dual-path hero + e2e

**Files:**
- Modify: `adk-web-ui/app/page.tsx`
- Create: `adk-web-ui/e2e/home-cta.spec.ts`
- Test: `adk-web-ui/e2e/home-cta.spec.ts`

**Interfaces:**
- Consumes: `useSession` from `next-auth/react` (same pattern as `Navigation.tsx`)
- Produces: Signed-out CTAs `Try free agents` + `Sign in for more`; signed-in CTA `Your sessions` → `/me/sessions`; upgrade explainer copy listing BYOK + Gmail/MCPs

- [ ] **Step 1: Write the failing Playwright spec**

Create `adk-web-ui/e2e/home-cta.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Home dual-path CTA (anonymous)', () => {
  test('shows free + sign-in CTAs and upgrade explainer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /try free agents/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in for more/i })).toBeVisible();
    await expect(page.getByText(/bring your own/i)).toBeVisible();
    await expect(page.getByText(/gmail/i)).toBeVisible();
    await expect(page.getByText(/mcp/i)).toBeVisible();

    // Repo link must not look like a primary CTA competitor — still present
    await expect(page.getByRole('link', { name: /view repository|github/i })).toBeVisible();
  });

  test('Try free agents scrolls to agents section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /try free agents/i }).click();
    await expect(page.locator('#agents-section')).toBeInViewport();
  });

  test('Sign in for more goes to auth', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /sign in for more/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `adk-web-ui`:

```bash
npx playwright test e2e/home-cta.spec.ts
```

Expected: FAIL — current home still has “Browse Agents”, not “Try free agents” / upgrade explainer.

- [ ] **Step 3: Implement home hero**

Replace the hero in `adk-web-ui/app/page.tsx` with an auth-aware dual-path. Keep `AgentGrid` / `#agents-section` as-is.

Required behavior and copy shape:

```tsx
'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AgentGrid from '@/components/AgentGrid';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  const { data: session, status } = useSession();
  const signedIn = status === 'authenticated' && !!session?.user;

  const handleCTAClick = () => {
    document.getElementById('agents-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low pt-16">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center max-w-4xl mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-md-primary/5 rounded-full blur-3xl -z-10" />

          <h2 className="text-display-medium sm:text-display-large font-bold text-md-on-surface mb-6 tracking-tight">
            Discover Google AI Agents
          </h2>
          <p className="text-body-large sm:text-headline-small text-md-on-surface-variant/80 mb-10 leading-relaxed max-w-2xl mx-auto font-light">
            A free, open-source directory of specialized agents built with Google ADK.
            Try any agent now — or sign in to unlock richer experiences.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button
              onClick={handleCTAClick}
              className="px-8 py-4 bg-md-primary hover:bg-md-primary/90 text-md-on-primary rounded-full text-label-large font-semibold transition-all duration-300 shadow-lg shadow-md-primary/25 hover:shadow-xl hover:shadow-md-primary/30 hover:-translate-y-0.5 flex items-center gap-2 group"
            >
              Try free agents
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {signedIn ? (
              <Link
                href="/me/sessions"
                className="px-8 py-4 bg-md-surface border border-md-outline hover:bg-md-surface-container-low text-md-on-surface rounded-full text-label-large font-medium transition-all duration-300 hover:border-md-outline-variant hover:-translate-y-0.5"
              >
                Your sessions
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="px-8 py-4 bg-md-surface border border-md-outline hover:bg-md-surface-container-low text-md-on-surface rounded-full text-label-large font-medium transition-all duration-300 hover:border-md-outline-variant hover:-translate-y-0.5"
              >
                Sign in for more
              </Link>
            )}
          </div>

          {!signedIn && (
            <p className="text-sm text-md-on-surface-variant/75 max-w-xl mx-auto mb-10 leading-relaxed">
              Sign in to unlock bring-your-own-keys (BYOK), connect Gmail and other MCPs
              for better agent experiences, plus higher limits and saved chat history.
              Agents stay free to try without an account.
            </p>
          )}

          <a
            href="https://github.com/Folken2/agent-directory"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-md-on-surface-variant/70 hover:text-md-on-surface underline-offset-4 hover:underline"
          >
            View repository
          </a>
        </div>
      </section>

      <section id="agents-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-headline-small text-md-on-surface font-semibold tracking-tight">
            Available Agents
          </h3>
        </div>
        <AgentGrid />
      </section>
    </div>
  );
}
```

Notes for the implementer:
- While `status === 'loading'`, prefer showing the signed-out pair (or a neutral disabled twin) — do **not** flash “Your sessions” then swap to “Sign in”.
- Do not use feature cards / icon grids for the upgrade explainer.
- Remove the old “Powered by Google Gemini 3 Flash” hero footer and the competing pill-style GitHub button.

- [ ] **Step 4: Run Playwright to verify it passes**

```bash
npx playwright test e2e/home-cta.spec.ts
```

Expected: PASS for all three anonymous tests.

- [ ] **Step 5: Manual signed-in spot check**

Sign in with Google locally, reload `/`. Confirm “Sign in for more” is gone, “Your sessions” links to `/me/sessions`, and the BYOK/MCP explainer is hidden.

- [ ] **Step 6: Commit**

```bash
git add adk-web-ui/app/page.tsx adk-web-ui/e2e/home-cta.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): add home dual-path signup CTA

Clarify free agents vs sign-in unlocks (BYOK, Gmail/MCPs) without shipping settings.
EOF
)"
```

---

### Task 2: Chat chrome cleanup (header + empty state)

**Files:**
- Modify: `adk-web-ui/app/chat/page.tsx` (header block ~lines 163–209)
- Modify: `adk-web-ui/components/chat/EmptyState.tsx`
- Test: extend `adk-web-ui/e2e/home-cta.spec.ts` **or** add assertions in a small chat smoke test below

**Interfaces:**
- Consumes: existing `selectedAgent` from store; `EmptyStateProps` unchanged
- Produces: header shows agent name only (no Gemini subtitle); empty state has no “Powered by Gemini…” and no signup/BYOK copy

- [ ] **Step 1: Write failing chat chrome assertions**

Create `adk-web-ui/e2e/chat-chrome.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Chat chrome', () => {
  test('empty chat does not show Gemini powered-by clutter', async ({ page }) => {
    // Use a known agent slug from the directory; adjust if directory changes.
    await page.goto('/chat?agent=google_explorer_agent');
    await expect(page.getByText(/powered by gemini/i)).toHaveCount(0);
  });
});
```

If `google_explorer_agent` is missing in the environment, pick any agent name returned by `/api/agents` in a setup step — but keep the assertion the same.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test e2e/chat-chrome.spec.ts
```

Expected: FAIL — header and/or empty state still contain “Powered by Gemini”.

- [ ] **Step 3: Clean header**

In `adk-web-ui/app/chat/page.tsx`, remove the Gemini subtitle under the agent name. Keep agent name as a link to `/agents/[name]`. When no agent is selected, keep a single-line “Select an agent to begin” (or equivalent) without the uppercase Gemini line.

Replace the agent title block with:

```tsx
{selectedAgent ? (
  <Link
    href={`/agents/${encodeURIComponent(selectedAgent.name)}`}
    className="flex flex-col items-start text-left ml-2 min-w-0 hover:opacity-90 transition-opacity"
  >
    <span className="text-[15px] font-semibold tracking-tight text-foreground leading-tight truncate max-w-[60vw] sm:max-w-md">
      {selectedAgent.displayName || selectedAgent.name}
    </span>
  </Link>
) : (
  <div className="ml-2 flex flex-col">
    <span className="text-[15px] font-semibold tracking-tight text-foreground leading-tight">
      Chat
    </span>
    <span className="text-xs text-muted-foreground mt-0.5">
      Select an agent to begin
    </span>
  </div>
)}
```

- [ ] **Step 4: Clean empty state**

In `adk-web-ui/components/chat/EmptyState.tsx`:
- Delete the `<p>…Powered by Gemini 3 Flash</p>` line.
- Keep greeting, description, GitHub source link, and sample prompts.
- Do **not** add BYOK/MCP/signup copy.
- Optional polish (same task): slightly tighten icon + title spacing; keep sample prompts as the main action affordance.

- [ ] **Step 5: Re-run Playwright**

```bash
npx playwright test e2e/chat-chrome.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add adk-web-ui/app/chat/page.tsx adk-web-ui/components/chat/EmptyState.tsx adk-web-ui/e2e/chat-chrome.spec.ts
git commit -m "$(cat <<'EOF'
refactor(chat): remove dated Gemini chrome from header and empty state

Keep agent identity and sample prompts; drop powered-by clutter.
EOF
)"
```

---

### Task 3: Message thread rhythm

**Files:**
- Modify: `adk-web-ui/components/chat/MessageList.tsx`
- Modify: `adk-web-ui/components/chat/MessageBubble.tsx`
- Modify: `adk-web-ui/components/chat/StreamingBubble.tsx`

**Interfaces:**
- Consumes: existing `MessageBubbleProps` / `StreamingBubbleProps` / `MessageListProps` — **do not change prop shapes**
- Produces: calmer visual hierarchy via className/layout only

- [ ] **Step 1: Tighten MessageList container**

In `MessageList.tsx`, change the thread container from `max-w-5xl … space-y-8` to a calmer reading column:

```tsx
<div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
```

Keep empty/streaming/init behavior identical.

- [ ] **Step 2: Soften user messages**

In `MessageBubble.tsx` user branch, replace the heavy bubble with a quieter chip:

```tsx
<div className="max-w-[min(85%,36rem)] rounded-2xl bg-muted/40 px-3.5 py-2 text-[15px] leading-relaxed text-foreground/90 text-left">
```

Keep markdown + motion enter (`opacity` / slight `y`). Prefer `y: 6` and `duration: 0.16` over larger jumps.

- [ ] **Step 3: Assistant as clean prose**

In assistant branch of `MessageBubble.tsx` and in `StreamingBubble.tsx`:
- Keep `max-w-3xl w-full` aligned with the list column.
- Use `text-[15px] leading-relaxed` on the prose wrapper.
- Do not wrap assistant text in a filled card/bubble background.
- Keep tools → thinking → sub-agents → content order.

Streaming placeholder when no content yet should reserve space to avoid jump:

```tsx
) : isThinking && streamingThinking ? null : (
  <div className="flex items-center gap-2 py-1 min-h-[1.75rem]">
    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
    <span className="text-sm text-muted-foreground">Thinking…</span>
  </div>
)}
```

- [ ] **Step 4: Manual verify**

Open `/chat?agent=<any>`, send a short message, confirm:
- User chip is quieter; assistant reads as prose
- Streaming does not shove layout when text starts
- Copy button still works on hover

- [ ] **Step 5: Commit**

```bash
git add adk-web-ui/components/chat/MessageList.tsx adk-web-ui/components/chat/MessageBubble.tsx adk-web-ui/components/chat/StreamingBubble.tsx
git commit -m "$(cat <<'EOF'
style(chat): calm message rhythm for modern thread feel

Narrow the reading column and soften user/assistant presentation.
EOF
)"
```

---

### Task 4: Compact tools + quiet thinking

**Files:**
- Modify: `adk-web-ui/components/ToolStatusDisplay.tsx`
- Modify: `adk-web-ui/components/ThinkingBlock.tsx`

**Interfaces:**
- Consumes: existing `ToolStatusDisplay({ messageId })` and `ThinkingBlock({ content, isStreaming })`
- Produces: same expand/collapse behavior; denser default chrome

- [ ] **Step 1: Quiet ThinkingBlock chrome**

Update the collapsed button in `ThinkingBlock.tsx` to drop the bordered card look:

```tsx
<button
  onClick={() => setIsExpanded(!isExpanded)}
  className={cn(
    'flex items-center gap-2 w-full text-left py-1 px-1 rounded-md transition-colors',
    'hover:bg-muted/40',
    isStreaming && 'text-foreground/80',
  )}
>
  <Brain className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0', isStreaming && 'animate-pulse')} />
  <span className="text-xs text-muted-foreground flex-1">
    {isStreaming ? 'Thinking…' : 'Thought process'}
  </span>
  {/* chevrons unchanged */}
</button>
```

Keep expand panel, but use lighter border (`border-border/20`) and no loud primary fill while streaming.

- [ ] **Step 2: Compact ToolStatusDisplay**

In `ToolStatusDisplay.tsx` outer wrapper:
- Replace the “TOOLS (n)” header with a single muted summary line, e.g. `Using tools · n` / `Used n tools`.
- Keep per-tool expand for args/response.
- Prefer one-line tool rows (`py-1`, no heavy backgrounds until hover).

Example header:

```tsx
<div className="flex items-center gap-1.5 mb-1 px-1 text-muted-foreground">
  <Wrench className="w-3 h-3" />
  <span className="text-[11px]">
    {runningTools.length > 0
      ? `Using tools · ${allTools.length}`
      : `Used ${allTools.length} tool${allTools.length === 1 ? '' : 's'}`}
  </span>
</div>
```

- [ ] **Step 3: Manual verify with a tool-using agent**

Chat with an agent that calls tools. Confirm:
- Tools appear as compact rows; expand still shows args/response
- Thinking is collapsed by default and visually secondary
- Existing ChatHistory / rate-limit sign-in copy unchanged

- [ ] **Step 4: Commit**

```bash
git add adk-web-ui/components/ToolStatusDisplay.tsx adk-web-ui/components/ThinkingBlock.tsx
git commit -m "$(cat <<'EOF'
style(chat): compact tool rows and quieter thinking blocks

Reduce chrome so the assistant answer stays the focus.
EOF
)"
```

---

### Task 5: Composer polish + motion pass + final verification

**Files:**
- Modify: `adk-web-ui/components/chat/Composer.tsx`
- Optionally tweak enter transitions already touched in Tasks 3–4 (keep to 2–3 intentional motions total)

**Interfaces:**
- Consumes: existing `ComposerProps` unchanged
- Produces: clearer focus/send hierarchy; disclaimer stays; no signup CTA

- [ ] **Step 1: Composer focus + send hierarchy**

In `Composer.tsx`:
- Align composer max width with thread: change inner `max-w-5xl` → `max-w-3xl`.
- Strengthen focused ring slightly (`ring-2 ring-ring/25` when focused) without glow spam.
- Keep attach left, send/stop right; stop must remain available whenever `busy && onStop`.
- Soften the disclaimer (sentence case, not uppercase tracking-widest):

```tsx
<p className="text-center text-xs text-muted-foreground/70 mt-3">
  AI can make mistakes. Please verify important information.
</p>
```

- [ ] **Step 2: Motion budget check**

Ensure only these intentional motions remain prominent:
1. Message enter (Task 3)
2. Tool/thinking expand (existing AnimatePresence — keep subtle)
3. Composer focus ring transition

Remove any new decorative animation added during polish that isn’t one of these.

- [ ] **Step 3: Full smoke checklist**

Run:

```bash
npx playwright test e2e/home-cta.spec.ts e2e/chat-chrome.spec.ts e2e/resume.spec.ts
```

Expected: home + chrome pass; resume suite behaves as before (skips authed tests without `E2E_TEST_USER_ID`).

Manual:
- [ ] Home signed-out dual CTA + explainer
- [ ] Home signed-in → Your sessions
- [ ] Chat empty state + header clean
- [ ] Send / stop / attach
- [ ] Tools + thinking compact
- [ ] Mobile: sidebar toggle still works; composer usable
- [ ] Chat still shows history/limits sign-in prompts only (no BYOK pitch)

- [ ] **Step 4: Commit**

```bash
git add adk-web-ui/components/chat/Composer.tsx
git commit -m "$(cat <<'EOF'
style(chat): align composer with thread and tighten focus states

Match reading width and keep send/stop hierarchy clear.
EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Home dual-path CTAs | Task 1 |
| Upgrade explainer (BYOK, Gmail/MCPs) messaging only | Task 1 |
| Repo link secondary | Task 1 |
| Signed-in → Your sessions | Task 1 |
| Chat shell unchanged | Tasks 2–5 (layout shell preserved) |
| No chat BYOK/MCP CTA | Tasks 2–5 |
| Keep chat history/limits prompts | Tasks 2–5 (untouched files) |
| Message rhythm | Task 3 |
| Streaming stability | Task 3 |
| Compact tools / quiet thinking | Task 4 |
| Composer polish | Task 5 |
| Remove Gemini chrome | Task 2 |
| Motion budget | Task 5 |
| Playwright / smoke verification | Tasks 1, 2, 5 |
