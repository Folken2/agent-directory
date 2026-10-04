# Agent Builder Sandbox — Run, Test and Preview Generated Agents

**Date:** 2026-10-04
**Status:** Approved (user: E2B as the sandbox provider; start with Step 1)
**Extends:** the nuvel-based builder (`agents/adk_agent_builder/`, PR #40)

## Goal

Turn the agent builder into a Cursor-style workspace: chat on the left, and on the right
a canvas where the agent being built runs live. Users test it while the builder changes
it. The builder can also run the project itself (install, import, tests), so it catches
real errors instead of only syntax errors.

## Where we start

- The builder writes a complete nuvel project into a per-session workspace on the backend
  (`workspace.py`), validates it (structure, placeholders, compile check) and hands it over
  as `<name>.zip`. **Nothing generated is ever imported or run.**
- The backend is one Railway container serving every agent, with the internal token, the
  Neon URL and the OpenRouter key in its environment.
- google-adk 2.10 ships experimental sandbox environments
  (`google.adk.integrations.e2b.E2BEnvironment`, `...daytona.DaytonaEnvironment`): create
  a sandbox, `execute` shell commands, `read_file` / `write_file`, with a TTL that every
  call extends.

## The rule that shapes everything

**Generated code never runs in the backend container.** It is written by an LLM steered by
anonymous visitors. Run there, one visitor could have a tool print `os.environ` (internal
token, database URL, LLM key), read other users' workspaces, or take the server down.

`user_id` does not help with this. In ADK it labels sessions and artifacts. It is not a
process, filesystem, network or secret boundary. The web app already derives it on the
server (`u_<id>` signed in, `a_<token>` anonymous) and ignores any client value
(`lib/adk-scope.ts`, `lib/identity.ts`). That stays.

So all execution happens in a disposable sandbox per build session, holding the project
files and nothing else.

## Decisions

| Topic | Choice |
|---|---|
| Sandbox provider | **E2B**, through ADK's `E2BEnvironment` (Daytona stays a drop-in alternative) |
| Isolation unit | One sandbox per chat session; never shared across sessions or users |
| Secrets in the sandbox | None from the server. Only `DEV_MODE`, Python flags |
| Who may run code | Signed-in users (`u_` ids). Anonymous visitors can still design, build and download |
| Sandbox image | Custom E2B template: Python 3.11 + nuvel's template `requirements.txt` + pytest, built by `sandbox_template.py` |
| Source of truth for files | The backend workspace (Step 1), object storage later (Step 3). The sandbox is disposable |
| Persistence | Not a Railway volume. ADK artifact service on GCS/S3, with `user:` artifacts for per-user projects (Step 3) |
| Preview UI | `adk web` in the sandbox, embedded in the canvas (Step 2); own test panel later (Step 4) |
| LLM key for previews | **Open**: capped per-sandbox key vs bring-your-own (Step 2) |

## Architecture

```
Browser ─ chat (left) ──► Next.js ──► ADK server: builder
   │                                     │  (no generated code runs here)
   │                                     │  sync files, run commands, start preview
   │                                     ▼
   └─ canvas (right) ◄─ preview URL ── E2B sandbox for this session
                                         /home/user/projects/<name>  (project files)
                                         pip deps from the template, pytest
                                         Step 2: `adk web --reload` on a port
```

## Steps

### Step 1 — the builder runs the project (no UI change)

Two builder tools, registered only when `E2B_API_KEY` is set:

- **`run_checks`**: upload the project, install requirements (skipped when unchanged),
  import `<package>.agent`, run `pytest`. Returns pass/fail per step with output tails.
- **`run_in_sandbox(command)`**: one shell command in the project root, for debugging
  (`python -m pytest tests/test_tools.py -x -vv`, `pip show litellm`).

Flow: `validate_agent` → `run_checks` → fix → `run_checks` … → `package_agent`.

Details:
- **Sync**: tar.gz of the project (same file set as the zip: no `.env`, no caches),
  written once and extracted over a clean directory, so deleted files disappear.
- **Install**: marker file per `requirements.txt` hash, kept *inside* the sandbox.
  `E2BEnvironment` silently recreates an expired sandbox, so the marker disappearing is
  how we notice installs were lost.
- **Registry**: process-local map of session key → environment and a lock. Calls in one
  session are serialised; idle entries are dropped after the TTL (E2B kills them anyway).
- **Limits**: sandbox TTL, per-command timeouts (install longer than tests), runs per
  session (counted in session state), active sandboxes per server, output truncated to a
  tail.
- **Tests must not reach real services**: the sandbox has no keys, so the prompt tells
  the builder to mock LLM and API calls in the tests it writes.

Done when: with `E2B_API_KEY` and a template, a signed-in builder session can run a
scaffolded project's import check and tests in E2B, see failures, fix them and re-run.
Anonymous sessions get a clear "sign in to run" result. Without the key, nothing changes.

### Step 2 — live preview canvas

- `start_preview` tool: `adk web --reload --host 0.0.0.0 --port 8000` in the project
  directory (background command), then `sandbox.get_host(8000)` for the URL.
  `adk web` serves the dev UI with the event, trace and state inspector.
- The URL lands in state (`builder:preview`); the web UI picks it up from `state_delta`,
  like the blueprint, and opens the canvas.
- File writes already re-sync; `--reload` picks them up.
- **Preview access**: the host URL is reachable by anyone who has it, and the agent spends
  our LLM key. Proxy it through Next.js with the user's session, or use E2B's access
  controls if they cover HTTP ports. To decide before Step 2 ships.
- **LLM key** (open decision):
  1. a per-sandbox OpenRouter key with a small credit limit, revoked when the sandbox ends;
  2. bring-your-own key, entered in the canvas and stored only in the sandbox's env;
  3. worth evaluating: E2B egress rules (`network.rules` transforms) that add the key to
     requests to `openrouter.ai` in transit, so code in the sandbox never sees it.
  Whatever the choice, nuvel's `COST_GUARD_BUDGET` in the generated agent is a second cap.
- Third-party credentials (Slack, Gmail …): mock by default; BYO keys only into the
  sandbox env, never into our database or session state.

### Step 3 — files and saved projects

- Canvas tabs: Preview | Files | Logs. Files is read-only first.
- Persist projects in the ADK artifact service on object storage (`artifact_service_uri`
  `gs://` or S3), as `user:` artifacts so they belong to the user, not one chat.
  Survives redeploys and works with more than one backend replica.
- "Open project" re-hydrates the workspace and the sandbox.

### Step 4 — own test panel, deploy

- Replace the `adk web` iframe with our chat UI pointed at the sandbox's `/run_sse`
  through a proxy (same look, our auth).
- Optional "Deploy to Railway" from the generated `railway.json`.

## Abuse and cost

- E2B bills sandbox time. TTL (default 15 min) and idle reaping bound it; runs per
  session and active sandboxes per server cap it.
- Sandboxes have internet access (pip needs it). Code runs only for signed-in users, in a
  sandbox with no secrets; E2B's egress allow-lists can tighten this later.
- The sandbox can be recreated by E2B at any time; every run starts by re-uploading the
  project, so correctness never depends on sandbox state.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `E2B_API_KEY` | unset | Enables the sandbox tools |
| `BUILDER_E2B_TEMPLATE` | `base` | Template name; build ours with `sandbox_template.py` |
| `BUILDER_SANDBOX_SIGNED_IN_ONLY` | `1` | Only `u_` users may run code. Set `0` for local dev |
| `BUILDER_SANDBOX_TTL` | `900` | Sandbox time-to-live (s), extended on every call |
| `BUILDER_SANDBOX_INSTALL_TIMEOUT` | `600` | Seconds for `pip install` |
| `BUILDER_SANDBOX_COMMAND_TIMEOUT` | `300` | Seconds for imports, tests and `run_in_sandbox` |
| `BUILDER_SANDBOX_MAX_RUNS` | `30` | `run_checks` + `run_in_sandbox` calls per session |
| `BUILDER_SANDBOX_MAX_ACTIVE` | `10` | Sandboxes alive at once on one server |
| `BUILDER_SANDBOX_PYTHON` | `python3` | Interpreter inside the sandbox |

## Open questions

1. Preview LLM key: options 1–3 above.
2. Preview access control: proxy vs E2B access control.
3. Should `package_agent` refuse to package when the last `run_checks` failed? (Step 1
   leaves it advisory: validation is still the hard gate.)
