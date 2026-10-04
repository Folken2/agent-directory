# Builder Sandbox, Step 2 — Live Preview Canvas — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Next to the builder chat, the user talks to the agent being built, running live
in its E2B sandbox, while the builder keeps changing it.

**Design:** `docs/superpowers/specs/2026-10-04-builder-sandbox-design.md` (Step 2)

**Decisions (user):** proxy the preview through the web app; our capped key; protect the
preview link.

**Architecture:** The builder's `start_preview` tool runs the project's own `run_adk.py`
in the sandbox (DEV_MODE, `reload_agents`) on a private port, with a per-start API key
and a capped OpenRouter key. The ADK backend's `preview_api.py` is the only way in.
Next.js `/api/preview` checks the browser owns the builder session and relays. The
panel is our own React chat over the ADK event stream.

## Global Constraints

- The browser never receives a sandbox URL, the E2B traffic token, the preview API key
  or the OpenRouter key. Session state holds only project, package, status, start time.
- Three locks: session ownership (Next.js), internal token (backend), private sandbox
  port (traffic token) plus the generated server's `API_KEY`.
- No sandbox-served HTML or JS on our origin: no `adk web` iframe.
- Without `E2B_API_KEY` and `OPENROUTER_MANAGEMENT_KEY` nothing changes.

---

### Task 1: Sandbox preview lifecycle — DONE

- [x] `PrivateE2BEnvironment`: `network={"allow_public_traffic": False}`, `endpoint()`,
      `start_background()` (E2B background command; secrets via `envs`), `kill()`,
      `keepalive()`.
- [x] In-place sync with a manifest, so a running preview keeps its working directory.
- [x] `start_preview` / `stop_preview` in `sandbox.py`: prepare, capped key, start, wait
      for `/health`, record; clean up the server and key on failure, stop and close.

### Task 2: Capped key — DONE

- [x] `openrouter_keys.py`: create with `limit` and `expires_at`, delete best effort.

### Task 3: Tools, prompt, proxy — DONE

- [x] `start_preview` / `stop_preview` tools (gated, counted as runs), `builder:preview`
      state, prompt section.
- [x] `preview_api.py`: status, `run_sse` (session recreated by id after restarts;
      keepalive; message cap), stop. Mounted by `run_adk.py` under the internal token.

### Task 4: Web — DONE

- [x] `/api/preview` route (GET status, POST stream with `guardStream`, DELETE stop).
- [x] `builder:preview` state delta → stream chunk → store.
- [x] `PreviewPanel`: column on wide screens, full screen on phones; New, Stop, Close;
      reopen from the header; discover a running preview on reload.

### Task 5: Tests — DONE

- [x] Backend: capped keys (mock transport), start/stop/restart/failure/anonymous/close,
      proxy headers and session recreation, limits, expiry, validation, and a real boot
      of a generated server that enforces its `API_KEY`.
- [x] Real server stack: the tool started through ADK's loader and the proxy mounted by
      `run_adk.py` share one registry.
- [x] Web: parsers, assembler chunk, `streamPreview`, e2e for the panel (desktop and phone).
