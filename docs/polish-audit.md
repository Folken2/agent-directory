# Site polish audit — 2026-11-02

Scope: home, `/examples`, `/agents/exa_mcp_agent`, `/guides`, `/guides/adk-mcp-toolset`,
`/contact`, `/about`, `/chat?agent=exa_mcp_agent` and the 404 page, on production
(https://agentdirectory.folch.ai, commit `0332993`), at 1440×900 and 390×844, light and dark.

How it was checked:

- Screenshots of every page in all four modes (Playwright, cold profile, so the cookie banner shows).
- axe-core 4.10 on every page in all four modes (banner dismissed first).
- Console errors, failed requests, cumulative layout shift and horizontal overflow per page.
- Keyboard: tabbing through the home page and the chat.

What was fine: no console errors and no failed requests apart from the intended 404; CLS is 0 on
every content page (0.015 on mobile chat); no horizontal scroll at 390px; every image has alt
text; every page has its own title and Open Graph image (agent pages get a per-agent one); the
favicon is set; nav and buttons show a focus ring.

Severity: **High** = visible to most visitors or an accessibility failure on every page.
**Medium** = noticeable, affects some pages or users. **Low** = detail.
"Fixed" items are in PR #52.

## Findings

| # | Sev | Page | Finding | Fix | Status |
|---|-----|------|---------|-----|--------|
| 1 | High | All pages, light | Secondary text (`--md-on-surface-variant`, `#65758b` on `#f9fafb`) is 4.49:1, just under WCAG AA 4.5:1. axe flags 13–95 elements per page: nav links, descriptions, footer. | Darken the token from 47% to 43% lightness (≈5:1). | Fixed |
| 2 | High | `/chat` first visit | The cookie banner sits at the bottom of the screen, on top of the composer. On mobile it hides the composer entirely, so the first thing a visitor must do in the chat is dismiss a dialog. | On `/chat` the banner sits under the header. | Fixed |
| 3 | High | `/chat` | Slow to load: composer usable after ~1.0 s on desktop, ~2.1 s on throttled mobile, because the agent was resolved through `/api/agents` (a Railway round trip). See PR #52 for the before/after numbers. | Resolve the agent from the bundled catalog; split the message renderers out of the first load; drop the hidden footer. | Fixed |
| 4 | Medium | `/chat` mobile | The Back link shows only an arrow below 640px and has no accessible name (axe `link-name`). | `aria-label` on the link. | Fixed |
| 5 | Medium | `/chat` | No `<h1>`; screen-reader users get no page heading. | `sr-only` h1 "Chat with {agent}". | Fixed |
| 6 | Medium | `/chat` sidebar | Empty state reads "No past chats yet / START A NEW CHAT TO BEGIN" in letter-spaced caps at 2.2:1 contrast; the sign-in hint is 11px at 2.6:1. Looks like template filler. | Sentence case, 12px, full secondary colour. | Fixed |
| 7 | Medium | About, Contact, Privacy, guides | Links inside paragraphs are blue but not underlined; 1.1:1 against the body text, so colour is the only cue (axe `link-in-text-block`). | `proseLink` is underlined (40% opacity decoration, full on hover). | Fixed |
| 8 | Medium | Guide code blocks | The language label and Copy button are faded (opacity 60–80%), below AA in dark mode; long code lines scroll sideways but the scroller can't be reached by keyboard (axe `scrollable-region-focusable`). | Full-opacity label and button, focus ring on Copy, `tabIndex=0` on the code. | Fixed |
| 9 | Medium | 404 | Title is the home page's ("ADK Agent Directory \| Build and Try…"), so a 404 tab or share looks like the home page. | `Page not found \| ADK Agent Directory`. | Fixed |
| 10 | Low | Repo | `public/` still has create-next-app's `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`, unused and publicly served. | Deleted. | Fixed |
| 11 | Medium | Home, Examples, agent pages, 404 | Data Analyst has no logo, so its card shows a grey "D" monogram next to real logos. Looks unfinished. | Add a logo to `agents/data_analyst_agent/metadata.json` and run `npm run sync:agent-catalog`. | Open: needs an asset |
| 12 | Medium | All agent cards | Logos are hot-linked third-party favicons (`google.com/favicon.ico` for Local Guide **and** Image Architect, `tavily.com`, `exa.ai`, GitHub, …). Two agents wear the Google "G", which reads as Google branding on a site that says it is not affiliated with Google; any of these hosts can change or block the image. | Self-host one icon per agent in `public/agents/`, and don't use Google's mark for agents that only use Google APIs. | Recommendation |
| 13 | Medium | `/contact` | The only calls to action are GitHub, LinkedIn and Website, with GitHub as the primary filled button. For a consulting-lead page there is no email or form, and the primary action sends people to a code host. | Add a contact email or a short form (name, email, what you're building) as the primary action. Business decision. | Recommendation |
| 14 | Low | `/examples` | Card titles are `h3` directly under the page `h1` (axe `heading-order`). | Make the card titles `h2`, or add a visually hidden "All examples" `h2`. | Open |
| 15 | Low | Home, Examples | Card descriptions are cut with a typed "…" at different lengths; the chat empty state clamps the description and shows "LinkedIn.." when the cut lands after a full stop. | Clamp with CSS only, and trim a trailing full stop before the ellipsis. | Open |
| 16 | Low | Site-wide | The site calls itself "Agent Directory" in the header and footer and "ADK Agent Directory" in titles, JSON-LD and social cards. | Pick one name. | Recommendation |
| 17 | Low | Agent pages | "What it's good at" items use Title Case ("Company Research") while every other heading is sentence case. | Sentence case in `metadata.json` use-case titles. | Open |
| 18 | Low | `/guides` | One guide in a two-column grid leaves half the page empty. Fine for now; it will look intentional once there are 3+. | Single full-width card until there are more guides. | Recommendation |
| 19 | Low | All pages | No "Skip to content" link; keyboard users tab through 7 nav items on every page. | Skip link in `app/layout.tsx` targeting `<main id="main">`. | Fixed |
| 20 | Low | All pages | Sentry's browser SDK is ~124 KB gzipped of every page's JavaScript, the largest single dependency on the chat route after the split in PR #52. | Lazy-load Sentry or drop browser tracing (`tracesSampleRate`) if it is not used. Needs a decision on what Sentry is for. | Recommendation |

## Bigger questions for the owner

1. **Agent identity.** Findings 11 and 12 together: commissioned or self-made icons for each
   example would do more for the "professional" feel than any spacing fix. The cards are the
   most-repeated element on the site.
2. **Contact conversion.** Finding 13: decide whether `/contact` should collect leads directly
   (form plus Resend, which the project already depends on) or stay a list of profiles.
3. **Chat first message.** Loading is fixed in PR #52, but the first reply still waits on about
   six sequential server steps in `/api/run_sse` (identity, rate-limit reservation, user lookup,
   run tracking, ADK session GET, then POST, then `/run_sse`). Most of these could run in parallel,
   or be skipped for a new session id. Worth measuring next. I didn't change it here because it
   needs real messages against the live backend to measure.
