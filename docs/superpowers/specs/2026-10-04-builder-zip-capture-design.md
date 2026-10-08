# Builder: "Email me my build" replaces the blueprint

Date: 2026-10-04. Branch: PR 40 (`ccr-616d0ac7-0yh8pw`).

## Why

The builder now delivers a complete project as `<name>.zip`. The blueprint
(a JSON design shown as a card, saved with an email for follow-up) was built
for the advice-only builder. Showing both is redundant, and the model kept
re-emitting the blueprint after packaging.

The site is open source and should stay open to everyone, but we want emails.
The zip lives in the backend's in-memory artifact service, so it is lost on
restart. Keeping the build becomes the reason to leave an email.

## Decisions

- **No blueprint anywhere.** The builder designs in prose, asks to build, then
  builds.
- **Everything stays open.** Design, build and in-chat download need no
  account and no email.
- **Every build is recorded anonymously.** `package_agent` writes a build
  summary to session state. ADK keeps it in the `sessions` table, which the
  ops analytics already read.
- **The ask: "Email me a permanent link".** It sits under the zip at the
  moment of value. We store the zip and email a unique link through Resend.
  The link only reaches the inbox, so a working address is proven without an
  account.
- **Consent stays separate.** The link email is transactional: the user asked
  for it. Two optional, unticked boxes cover the rest: "Send me updates about
  the builder" (marketing opt-in) and "I'd like help deploying it" (owner
  follow-up plus the booking link).
- **Open-source friendly.** Without `RESEND_API_KEY` (self-hosting, local
  dev) the link is logged to the server console and shown in the dialog, so the
  feature works with no email provider.
- **Existing data is kept.** `blueprint_submissions` stays in the database
  untouched; only the code that writes and reads it goes.

## Backend (agents/adk_agent_builder)

### Remove

- `blueprint.py`, `callbacks/blueprint_document.py` and the
  `after_model_callback=capture_blueprint` wiring in `agent.py`.
- `BLUEPRINT_INSTRUCTION` and its use in `build_prompt_v3`, including the
  "Blueprint status" note added while testing PR 40. `prompt_v2` goes too if
  only the old tests use it.
- `tests/test_blueprint.py` and the blueprint prompt tests in
  `tests/test_agent_builder.py`.

### Prompt

- Workflow step 2 (Design) ends with "summarise the design in a few lines and
  ask whether to build it" instead of "End with the blueprint".
- The hand-over step adds: "Under the zip the user can email themselves a
  permanent link; mention it in one line. Do not ask for their email in the
  chat."

### State written by the tools

`scaffold_agent` also stores what it was asked for:

```
builder:project = {"description": str, "options": {<scaffold_agent's option params>: bool}}
```

`package_agent`, after the artifact is saved, writes:

```
builder:build = {
  "name": "research-summarizer", "package": "research_summarizer",
  "description": "...", "options": {...},            # from builder:project
  "models": {"fast": "openrouter/...", "reasoning": "openrouter/..."},
  "tools": ["web_search", ...],                      # modules in <package>/tools/, minus __init__
  "skills": ["sourced-summary", ...],                # dirs under <package>/skills/ with a SKILL.md
  "artifact": "research-summarizer.zip", "version": 0,
  "files": 41, "bytes": 58213, "packagedAt": "2026-10-04T09:12:00Z"
}
```

- `models` comes from the `FAST_MODEL=` / `REASONING_MODEL=` lines of
  `.env.example`, falling back to the defaults in `<package>/config/llm.py`.
  Missing values are `null`. This pairs with the `list_models` prompt rule.
- Each repackage overwrites `builder:build`.
- At most 50 tools and 50 skills are kept, with names truncated to 64 chars.

## Web app (adk-web-ui)

### Stream → chat

Same path the blueprint used:

- `adk-client.ts` reads `stateDelta['builder:build']`, parses it with
  `parseBuild` (`lib/build/parse.ts`, defensive) and yields
  `{type: 'build', build}`.
- `stream-assembler.ts` keeps it. `Message.build` replaces
  `Message.blueprint`.
- `payloads.ts` emits a `{type: 'build'}` payload. It drops the generic
  artifact whose name equals `build.artifact`, so the zip isn't shown twice.
- `renderers/index.tsx` renders `BuildCard`.

### BuildCard (`components/build/BuildCard.tsx`)

The card shows the name, description, nuvel options as chips, the two models,
counts (files, tools, skills) and size. It has two actions:

- **Download zip** fetches
  `/api/artifacts?app_name=adk_agent_builder&session_id=…&artifact_name=<artifact>&version=<version>`
  (the route already supports single artifacts). On 404, the backend restarted
  and the zip is gone: the card says so and suggests asking the builder to
  package it again.
- **Email me a permanent link** is the primary action under the download. It
  opens `EmailBuildDialog`.

### EmailBuildDialog

- An email field, prefilled from the session if signed in.
- "Send me updates about the builder and nuvel": optional, unticked.
- "I'd like help deploying it": optional, unticked.
- A one-line notice linking to the privacy page.
- Sending shows "Check your inbox" (plus the booking link if help was ticked).
  In dev mode, with no Resend key, it also shows the link itself.

### `POST /api/builds`

Body: `{email, sessionId, updates: boolean, help: boolean}`. The client never
sends the build or the zip.

The route runs these steps in order:

1. Cross-origin guard.
2. Validation: email trimmed, lowercased, ≤254 chars, regex; `sessionId`
   required, `/^[A-Za-z0-9_-]{1,128}$/`.
3. DB check (`temporarily_unavailable` without a DB).
4. Identity (`resolveIdentity`, anonymous or signed in).
5. Daily rate limits: user 10, anonymous token 3, anonymous IP 10. They're set
   by `BUILD_SAVE_USER_DAILY` / `BUILD_SAVE_ANON_DAILY` /
   `BUILD_SAVE_ANON_IP_DAILY`, with keys `bd:u:` / `bd:a:` / `bd:ip:`.
6. Load the build from the caller's own ADK session (`GET
   /apps/adk_agent_builder/users/<caller id>/sessions/<sessionId>`, server
   side) and read `builder:build`. Return 404 if it's missing. Then fetch the
   zip artifact by name and version from ADK. Return 410 with "ask the builder
   to package it again" if the artifact is gone. Reject zips over `BUILD_MAX_ZIP_BYTES` (default 10 MB).
7. Store a `build_saves` row with a fresh token. Only the token's sha256 is
   stored. The token is 32 random bytes, base64url.
8. Send the email with Resend:
   - `from: BUILD_EMAIL_FROM`, subject "Your agent: <name>".
   - A short html and text body: what was built, the link
     `${NEXT_PUBLIC_BASE_URL}/builds/<token>`, and how to run it.
   - Idempotency key `build-link/<save id>`.
   - The SDK returns `{data, error}`, so check `error`; a try/catch isn't
     enough.
   - On a send error, the row stays with `email_sent_at` null, the reservation
     is released and the user sees "couldn't send, try again".
9. If `updates` is true and `RESEND_SEGMENT_ID` is set, add the contact to that
   Resend segment. A failure is logged and never fails the request.
10. Notify the owner webhook (`BUILD_WEBHOOK_URL ?? BLUEPRINT_WEBHOOK_URL`,
    secret likewise) with `{type: 'build.saved', id, email, signedIn,
    projectName, updates, help, markdown}`. A failure only sets
    `notified=false`.
11. Respond `{id, sent: true, bookingUrl?}`. `bookingUrl`
    (`BUILD_BOOKING_URL ?? BLUEPRINT_BOOKING_URL`, https only) is returned
    only when `help` is true. In dev mode, with no Resend key, the response
    also carries `link`, and the link is logged.

### `/builds/[token]` page and download

- **Page.** Server-rendered. It hashes the token and looks it up, then shows
  the build summary, a **Download zip** button, "Run it locally" steps, and
  **Delete this build**.
- **Unknown token.** A plain 404 that never says whether a token exists.
- **Download.** `GET /api/builds/[token]/zip` streams the stored bytes with
  `Content-Disposition: attachment; filename="<name>.zip"`. It counts
  downloads and sets `last_downloaded_at`.
- **Delete.** `DELETE /api/builds/[token]` (same-origin guard) wipes the zip
  and email from the row and sets `deleted_at`. The page then says the build
  was deleted. This is the self-service deletion the privacy page promises.
- **Indexing.** These pages send `noindex` and a `no-referrer` referrer policy,
  so tokens don't leak through search engines or referrers.

### Table `build_saves`

Migration `0015_build_saves.sql` plus a drizzle schema file, with the same
`CREATE TABLE IF NOT EXISTS` bootstrap that `db-store.ts` uses today.

| column | type |
|---|---|
| id | uuid pk, `gen_random_uuid()` |
| created_at | timestamptz not null default now() |
| token_hash | text not null unique |
| email | text (null after delete) |
| user_id | text (null when anonymous) |
| session_id | text not null |
| project_name | text not null |
| build | jsonb not null |
| zip | bytea (null after delete) |
| zip_bytes | integer not null |
| updates_consent_at | timestamptz (null unless opted in) |
| help_requested | boolean not null default false |
| email_sent_at | timestamptz |
| notified | boolean not null default false |
| downloads | integer not null default 0 |
| last_downloaded_at | timestamptz |
| deleted_at | timestamptz |

Indexes on `created_at` and `session_id`. Analytics reads only the metadata
columns, never `zip`.

### Env vars (all optional)

Nothing deployment-specific is hardcoded: no domain, sender, site URL, booking
link or segment. Links use `NEXT_PUBLIC_BASE_URL`; the email names the site from
that host. Limits are env vars with defaults.


| var | effect |
|---|---|
| `RESEND_API_KEY` | Sends the link email. Unset: dev mode, the link is logged and returned. |
| `BUILD_EMAIL_FROM` | Sender address, on a domain verified in Resend (e.g. `Name <builds@your-domain>`). Required when the key is set; without it the route treats email as unconfigured and uses dev mode. |
| `BUILD_EMAIL_REPLY_TO` | Optional reply-to address. |
| `BUILD_MAX_ZIP_BYTES` | Largest zip stored (default 10 MB). |
| `RESEND_SEGMENT_ID` | Opted-in contacts are added to this segment, for later broadcasts. |
| `BUILD_WEBHOOK_URL` / `_SECRET` | Owner notification. Falls back to the `BLUEPRINT_*` names. |
| `BUILD_BOOKING_URL` | Booking link for "help". Falls back to `BLUEPRINT_BOOKING_URL`. |
| `BUILD_SAVE_*_DAILY` | Rate limits as above, with `BLUEPRINT_SAVE_*` fallbacks. |

All of these go into `env.example`. The `resend` npm package (>= 6.9.2) is a
new dependency.

### Remove

These go:

- `lib/blueprint/*`, `components/blueprint/*` and
  `app/api/blueprints/route.ts`.
- `e2e/blueprint.spec.ts`.
- The blueprint types and branches in `types.ts`, `adk-client.ts`,
  `stream-assembler.ts`, `payloads.ts` and the renderers.

The `blueprint-submissions` drizzle schema file stays, marked legacy, so
`drizzle-kit generate` doesn't emit a drop.

### Ops analytics

- **`adk-events.ts`:**
  - `has_build = state ? 'builder:build'`.
  - `emailed = EXISTS build_saves WHERE session_id = s.id AND email_sent_at IS NOT NULL`.
  - `fetchBuilderBuilds` replaces `fetchBuilderBlueprints`.
- **`conversation-insights.ts`:**
  - The outcome ranks emailed > zip > error > turns.
  - The builder funnel becomes started → continued → **Got a zip** →
    **Emailed it** → **Asked for help**.
  - `buildInsights` replaces `blueprintInsights`: totals, emailed, updates
    opt-ins, help requests, nuvel option counts, model counts, top tools and
    the latest builds.
- **`ConversationsView` / `InsightsView`:** labels and filters follow (`zip`,
  `emailed`).
- **`sentry-scrub.ts`:** also redacts `bd:` keys and `/builds/<token>` paths.

### Copy

- **Privacy.** "Saved blueprints" becomes "Builds you email yourself":
  - Every build is recorded without personal data.
  - Emailing a build stores the email, the zip and the build summary, to send
    and serve the link.
  - Updates only go out with the opt-in. Help requests notify the owner.
  - "Delete this build" on the link page removes the email and the zip.
- **About.** Drop "a blueprint you can copy, download or save" and say the
  builder hands you a zip you can email yourself.

## Out of scope

- Quotas for anonymous use, and keeping sandbox and preview for verified
  emails. The verified email from this flow is the identity those quotas will
  use later.
- Persisting the in-chat artifact across restarts. The emailed link covers
  that.
- Sending broadcasts. Opt-ins land in the Resend segment for when you want it.

## Testing

- **pytest:**
  - `scaffold_agent` stores `builder:project`.
  - `package_agent` writes `builder:build`: models from `.env.example` with
    the `config/llm.py` fallback, tools and skills listed, caps applied, and
    nothing written when validation fails.
  - The agent has no blueprint callback and the prompt has no
    `blueprintjson`.
- **vitest:**
  - `parseBuild`.
  - The assembler and payloads, including the duplicate zip being dropped.
  - Request validation.
  - Token generation and hashing.
  - The email body builder, including that no domain or URL appears that
    didn't come from env.
  - The Resend sender: a mocked SDK returning `{error}`, the idempotency key,
    and dev mode with no key.
  - Insights: funnel and `buildInsights`.
  - `sentry-scrub` for `bd:` keys and `/builds/` paths.
- **Route tests (`/api/builds`):**
  - 404 with no build in the session, and 410 when the artifact is gone.
  - Rate limit.
  - No contact call without `updates`.
  - `bookingUrl` only with `help`.
- **Route tests (zip and delete):** unknown token gives 404, delete wipes the
  zip and email, and a download after delete gives 404.
- **e2e `build.spec.ts`:** with stubbed SSE and API:
  - the card renders and the zip isn't shown twice;
  - Download requests the single-artifact URL;
  - the email dialog posts the right body and shows "Check your inbox";
  - in dev mode the `/builds/<token>` page downloads and deletes.
- **Manual:**
  - Build locally, email the link to `delivered@resend.dev` with a test key,
    or use dev mode without one.
  - Open `/builds/<token>`, download, delete.
  - Check the ops page.
