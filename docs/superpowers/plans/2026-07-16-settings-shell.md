# Settings Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a signed-in-only `/settings` shell with Keys and Connections placeholders so future BYOK/MCP work has honest destinations.

**Architecture:** Next.js App Router layout under `app/settings/` with shared section nav; server `auth()` gate mirroring `/me/sessions`; nav link in the signed-in cluster only. No key storage or OAuth.

**Tech Stack:** Next.js 16, next-auth `auth()`, existing sessions-page visual patterns, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-16-settings-shell-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `adk-web-ui/app/settings/layout.tsx` | Auth gate + shared section nav chrome |
| `adk-web-ui/app/settings/page.tsx` | Overview (identity + links) |
| `adk-web-ui/app/settings/keys/page.tsx` | BYOK coming-soon placeholder |
| `adk-web-ui/app/settings/connections/page.tsx` | MCP/Gmail coming-soon placeholder |
| `adk-web-ui/components/settings/SettingsNav.tsx` | Overview / API keys / Connections links |
| `adk-web-ui/components/Navigation.tsx` | Add Settings next to Sessions (desktop + mobile) |
| `adk-web-ui/e2e/settings-shell.spec.ts` | Anonymous redirect + page smoke (when signed in if feasible) |

---

### Task 1: Anonymous redirect e2e + settings layout gate

**Files:**
- Create: `adk-web-ui/e2e/settings-shell.spec.ts`
- Create: `adk-web-ui/app/settings/layout.tsx`
- Create: `adk-web-ui/components/settings/SettingsNav.tsx`

- [ ] **Step 1: Write the failing e2e for anonymous access**

```ts
import { test, expect } from '@playwright/test';

test.describe('Settings shell', () => {
  test('anonymous /settings redirects to sign-in with callback', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/auth\/signin/);
    expect(page.url()).toContain('callbackUrl');
    expect(decodeURIComponent(page.url())).toContain('/settings');
  });

  test('anonymous /settings/keys redirects to sign-in', async ({ page }) => {
    await page.goto('/settings/keys');
    await expect(page).toHaveURL(/\/auth\/signin/);
    expect(decodeURIComponent(page.url())).toContain('/settings/keys');
  });
});
```

- [ ] **Step 2: Run e2e — expect fail (404 or no redirect)**

```bash
cd adk-web-ui && npx playwright test e2e/settings-shell.spec.ts
```

- [ ] **Step 3: Add `SettingsNav` + auth-gated layout**

`SettingsNav`: client or server links for `/settings`, `/settings/keys`, `/settings/connections` with active state from pathname.

`layout.tsx`: `auth()`; if no user, `redirect` with `callbackUrl` set to the current path (use `headers()` / path from children segment — simplest: gate in each page OR use a layout that redirects to `/settings` callback and let pages set specific callbacks). Prefer **layout redirects to `/auth/signin?callbackUrl=/settings`** and each page also gates with its own path for deep links — actually **gate only in layout is wrong for deep link callbacks**. Gate in a small helper:

```ts
// lib/settings-auth.ts
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function requireSettingsUser(callbackPath: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }
  return session;
}
```

Call from layout with pathname: in Next 16 app layout we can use `headers().get('x-pathname')` if middleware sets it — **simpler: call `requireSettingsUser` in each page** and use layout only for chrome + `SettingsNav`. Layout still checks auth with callback `/settings` as fallback; pages pass their path.

Simplest solid approach: **middleware-free** — each page calls `requireSettingsUser('/settings/…')`; layout assumes authenticated and only wraps chrome (or layout also calls with `/settings`). Deep-link pages call their own path.

Layout:

```tsx
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireSettingsUser('/settings');
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <SettingsNav />
      {children}
    </div>
  );
}
```

And keys page also: `await requireSettingsUser('/settings/keys');` so callback is correct when hitting keys first while logged out.

- [ ] **Step 4: Re-run e2e — redirect tests pass**

---

### Task 2: Overview + placeholder pages

**Files:**
- Create: `adk-web-ui/app/settings/page.tsx`
- Create: `adk-web-ui/app/settings/keys/page.tsx`
- Create: `adk-web-ui/app/settings/connections/page.tsx`

- [ ] **Step 1: Overview page** — title Settings; show `session.user.name` / `email`; short unlock copy; links to keys, connections, `/me/sessions`. `robots: noindex`.

- [ ] **Step 2: Keys page** — “API keys (BYOK)”, coming soon, no submit controls.

- [ ] **Step 3: Connections page** — “Connections”, list Gmail / MCP as not available yet (text or disabled rows), no working toggles.

- [ ] **Step 4: Commit**

```bash
git add adk-web-ui/app/settings adk-web-ui/components/settings adk-web-ui/lib/settings-auth.ts adk-web-ui/e2e/settings-shell.spec.ts docs/superpowers
git commit -m "feat(settings): add signed-in settings shell with BYOK/MCP placeholders"
```

---

### Task 3: Nav link + e2e smoke for signed-out nav absence

**Files:**
- Modify: `adk-web-ui/components/Navigation.tsx`
- Modify: `adk-web-ui/e2e/settings-shell.spec.ts`

- [ ] **Step 1: Add Settings link** next to Sessions (desktop + mobile), `isActive('/settings')`.

- [ ] **Step 2: E2E** — on home while signed out, Settings link not visible (getByRole link name Settings count 0 in nav).

- [ ] **Step 3: Commit + open PR when asked**

---

## Verification

```bash
cd adk-web-ui && npx playwright test e2e/settings-shell.spec.ts
cd adk-web-ui && npm run lint
```

Manual: sign in → open Settings → Overview / Keys / Connections show coming-soon honesty; sign out → `/settings` → sign-in.
