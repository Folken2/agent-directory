# ADK Agent Builder

The Agent Directory's front door. Describe the agent you want; the builder designs it with you on the Google Agent Development Kit (ADK), then **builds it**: a complete, production-ready project on [nuvel](https://github.com/Folken2/nuvel), handed over as a zip you download from the chat.

It still answers plain ADK questions, grounded in nuvel's ADK skills and the official ADK docs.

## What you get

A standalone project from nuvel's ADK skeleton, with the agent's own brain written by the builder:

| Part | Where it comes from |
| --- | --- |
| FastAPI server with API-key auth, health checks, SSE streaming | nuvel skeleton (`run_adk.py`) |
| 17-plugin chain: cost guard, context window, tracing, resilience, guardrails, cache, memory, self-healing tools, … | nuvel skeleton (`<package>/plugins/`) |
| Guardrails (exfiltration guard, command safety), long-term memory, cron jobs | nuvel skeleton |
| Dockerfile, Railway config, `.env.example`, tests | nuvel skeleton |
| Optional: Workflow graph root, Composio integrations, Slack / Telegram / Teams gateways, ACP adapter, eval suite | nuvel options picked during design |
| System prompt, SOUL.md, tools, domain skills, README, tool tests | written by the builder |

Unzip it, then:

```bash
cd my-agent
cp .env.example .env     # add OPENROUTER_API_KEY
pip install -r requirements.txt
DEV_MODE=true python run_adk.py
```

## How a build goes

1. **Discover**: the builder asks only what it is missing (goal, tasks, services, channels, model).
2. **Design**: it loads nuvel's architecture and skill-design skills, picks models with `list_models`, proposes the agents, tools, skills and nuvel options, then summarises the design in a few lines and asks before building.
3. **Build**: `scaffold_agent` → `write_file` for the prompt, SOUL.md, tools, skills, requirements, README and tests → `validate_agent` until clean → `run_checks` until green (when the sandbox is on) → `package_agent`.
4. **Hand over**: a short summary plus `<name>.zip` in the chat. Under the zip, the web app offers to email the user a permanent link.

## Tools

| Tool | What it does |
| --- | --- |
| `scaffold_agent` | Stamps nuvel's skeleton (`nuvel.backends.adk.scaffold`) with the chosen options; the project becomes the session's current project |
| `write_file`, `read_file`, `list_files` | Edit the current project; paths are relative to its root |
| `validate_agent` | nuvel's checks: required files, no `{{placeholders}}`, every Python file compiles, skills have a `SKILL.md` |
| `package_agent` | Validates, zips the project (no `.env`, no caches) and saves it as the `<name>.zip` artifact |
| `list_models` | The best (Artificial Analysis agentic/coding/intelligence scores) and most-used current OpenRouter models with tool calling, with prices; falls back to the newest per family without `OPENROUTER_API_KEY` |
| `run_checks` | In an E2B sandbox: upload, install requirements, import `<package>.agent`, run pytest. Only with `E2B_API_KEY` |
| `run_in_sandbox` | One shell command in the project root inside the sandbox, for debugging. Only with `E2B_API_KEY` |
| `start_preview`, `stop_preview` | Run the project's own server in the sandbox for the live preview panel. Also needs `OPENROUTER_MANAGEMENT_KEY` |
| `list_composio_toolkits` | nuvel's Composio catalog lookup; only when the server has `COMPOSIO_API_KEY` |
| `list_skills`, `load_skill`, `load_skill_resource` | nuvel's 15 ADK skills via `SkillToolset` |
| `list_doc_sources`, `fetch_docs` | Official ADK docs via `mcpdoc` (launched with `uvx`) |

## Built on nuvel

`nuvel-cli` is a dependency of `agents/pyproject.toml`, pinned to a commit. The builder uses:

- **Skills**: every skill in `nuvel/backends/adk/skills/` (agent patterns, workflow graphs, tool creation, prompt engineering, callbacks/HITL, skill creation and design patterns, streaming, Composio, task delegation, long-horizon guardrails and sessions, cron isolation, memory).
- **Scaffolder and validator**: `scaffold_agent`, `validate_agent_dir`, `resolve_safe_path`.
- **Guards** on every tool call: `path_guard` (fixes paths like `my-agent/tools/x.py`) and `exfil_guard` (blocks secrets in tool arguments).
- **Plugins** on the builder's `App` (`nuvel_plugins.py`), on top of the server's own chain:

| Plugin | Role |
| --- | --- |
| `cost_guard` | Cost per call and per session in state; stops the session at `COST_GUARD_BUDGET` (default $2.00) |
| `context_window` | Live context usage in state |
| `resilience` | Tool-call rate limit, circuit breaker on scaffold/validate |
| `guardrails` | Halts a turn stuck in a loop; the user's next message resumes |
| `cache` | Per-session cache of reads and validation, cleared on every write |

nuvel's trace and tool-events plugins are not used: they keep per-run counters on the plugin instance, which would mix sessions on a shared server.

## Build records

Every build is recorded in session state, without personal data (`build_summary.py`):

- `scaffold_agent` stores `builder:project`: the description and the nuvel options it was asked for.
- `package_agent`, once the zip is saved, stores `builder:build`: name, package, description, options, models (from `.env.example`, falling back to `<package>/config/llm.py`), tools and skills (at most 50 each, names cut to 64 characters), the artifact name and version, file count, bytes and `packagedAt`. Each package overwrites it; nothing is written when validation fails.

The web app reads `builder:build` from the stream to show the build card, and the ops analytics read it from the `sessions` table.

## The workspace

Each chat session gets its own directory under `BUILDER_WORKSPACE_DIR` (default: `<tmp>/adk-agent-builder`), named from a hash of the user and session ids. Tools derive that path on the server for every call; session state only holds the project's name (`current_agent_name`, `current_agent_package`), which must pass nuvel's name check. Workspaces are scratch space: the zip artifact is the deliverable, and idle workspaces are deleted.

| Variable | Default | Meaning |
| --- | --- | --- |
| `BUILDER_WORKSPACE_DIR` | `<tmp>/adk-agent-builder` | Root of the per-session workspaces |
| `BUILDER_WORKSPACE_TTL_HOURS` | `24` | Idle workspaces older than this are deleted |
| `BUILDER_MAX_PROJECTS` | `3` | Projects per session |
| `BUILDER_MAX_FILE_BYTES` | `262144` | Largest file `write_file` accepts |
| `BUILDER_MAX_PROJECT_BYTES` | `8388608` | Largest project |
| `BUILDER_MAX_PROJECT_FILES` | `400` | Most files in a project |
| `COST_GUARD_BUDGET` | `2.00` | USD per session before the builder stops |
| `TOOL_RATE_LIMIT`, `TOOL_RATE_BURST` | `5`, `20` | nuvel's tool-call rate limit (whole server) |
| `COMPOSIO_API_KEY` | unset | Enables the Composio catalog lookup |

Generated code is never imported or run on the server; `validate_agent` only compiles it.

## Running the project: the E2B sandbox

With `E2B_API_KEY` set, the builder can run what it wrote, in a disposable [E2B](https://e2b.dev) sandbox per chat (ADK's `E2BEnvironment`; see `sandbox.py` and `docs/superpowers/specs/2026-10-04-builder-sandbox-design.md`):

- Every run uploads the workspace's files (the same set as the zip) over a clean copy, so the sandbox never holds anything the workspace doesn't.
- The sandbox gets no server environment variables: only `DEV_MODE` and Python flags. Tests the builder writes must mock LLM and API calls.
- Only signed-in users (web app ids `u_…`) run code; anonymous visitors still design, build and download.
- Requirements are installed once per `requirements.txt` version; the marker lives in the sandbox, so an expired and recreated sandbox reinstalls.

Setup:

```bash
cd agents
E2B_API_KEY=... uv run python -m adk_agent_builder.sandbox_template   # builds "adk-agent-builder"
# then on the server:
E2B_API_KEY=...
BUILDER_E2B_TEMPLATE=adk-agent-builder
```

The template is Python 3.11 with nuvel's template `requirements.txt` and pytest preinstalled, so checks start in seconds. Rebuild it after bumping nuvel. E2B's default `base` template works only if it has Python 3.11+; `run_checks` says so if it doesn't.

| Variable | Default | Meaning |
| --- | --- | --- |
| `E2B_API_KEY` | unset | Turns the sandbox tools on |
| `BUILDER_E2B_TEMPLATE` | `base` | E2B template to start sandboxes from |
| `BUILDER_SANDBOX_SIGNED_IN_ONLY` | `1` | Set `0` to let any user run code (local dev, where the user id is not `u_…`) |
| `BUILDER_SANDBOX_TTL` | `900` | Sandbox time-to-live in seconds, extended on every call |
| `BUILDER_SANDBOX_INSTALL_TIMEOUT` | `600` | Seconds for `pip install` |
| `BUILDER_SANDBOX_COMMAND_TIMEOUT` | `300` | Seconds for the import check, pytest and `run_in_sandbox` |
| `BUILDER_SANDBOX_MAX_RUNS` | `30` | `run_checks` + `run_in_sandbox` calls per chat |
| `BUILDER_SANDBOX_MAX_ACTIVE` | `10` | Sandboxes alive at once on one server |
| `BUILDER_SANDBOX_PYTHON` | `python3` | Interpreter inside the sandbox |

## Live preview

With `OPENROUTER_MANAGEMENT_KEY` also set, `start_preview` runs the project's own `run_adk.py` in the chat's sandbox and the web app opens a panel next to the chat where the user talks to their agent.

- **Private all the way.** The sandbox's port is private (`allow_public_traffic: False`, so E2B wants the traffic token) and the server wants a random per-start `API_KEY`. Only `preview_api.py` on the backend holds both. The browser goes through `/api/preview`, which checks it owns the builder chat, then the backend proxy under the internal token. Session state carries the project name and status, never a URL or key.
- **Our key, capped.** Each start creates an OpenRouter key through the management API with a spending limit and an expiry, deleted on stop, restart or sandbox close. The generated agent's own cost guard gets the same budget.
- **Kept current.** Uploads update the project in place and `reload_agents` picks up agent changes; the builder calls `start_preview` again after edits (needed for dependency changes).
- **Kept alive.** Each preview message extends the sandbox TTL; idle previews end with the sandbox.

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPENROUTER_MANAGEMENT_KEY` | unset | OpenRouter management key; with `E2B_API_KEY`, turns previews on |
| `BUILDER_PREVIEW_KEY_LIMIT_USD` | `0.50` | Spending limit of each preview's key |
| `BUILDER_PREVIEW_KEY_HOURS` | `2` | Expiry of each preview's key |
| `BUILDER_PREVIEW_MAX_MESSAGES` | `60` | Preview messages per builder chat |
| `BUILDER_PREVIEW_START_TIMEOUT` | `90` | Seconds to wait for the server's `/health` |

## Project structure

```text
adk_agent_builder/
├── agent.py             # root_agent (skills, tools, guards) and app (nuvel plugins)
├── nuvel_plugins.py     # nuvel plugin chain for the builder
├── workspace.py         # per-session workspace, limits, cleanup
├── sandbox.py           # E2B sandbox per session: upload, install, run, preview
├── sandbox_template.py  # builds the E2B template (nuvel requirements + pytest)
├── openrouter_keys.py   # capped, expiring OpenRouter keys for previews
├── preview_api.py       # backend proxy to the preview (mounted by run_adk.py)
├── build_summary.py     # builder:project / builder:build session state
├── tools/
│   ├── __init__.py      # get_tools()
│   ├── project_tools.py # scaffold / write / read / list / validate / package
│   ├── model_tools.py   # list_models (OpenRouter benchmarks, usage, catalogue)
│   └── sandbox_tools.py # run_checks / run_in_sandbox / start_preview / stop_preview
├── config/
│   ├── llm.py           # FAST_MODEL / REASONING_MODEL (LiteLLM, OpenRouter)
│   └── utils.py         # date helper
├── prompt/
│   └── prompt.py        # versioned prompts; build_prompt_v3 is current
└── metadata.json        # web UI metadata
```

## Running it

From the repository root:

```bash
cd agents && uv sync && cd ..
adk web agents            # or: python run_adk.py (needs SESSION_SERVICE_URI)
```

Tests: `python -m pytest tests/test_agent_builder.py tests/test_build_summary.py tests/test_builder_sandbox.py tests/test_builder_preview.py tests/test_builder_models.py`.

## Customization

- **Model**: `FAST_MODEL` in `.env` or `config/llm.py`.
- **Prompt**: `prompt/prompt.py`. Prompts are versioned; add `PROMPT_V4` for substantive changes.
- **nuvel version**: bump the commit in `agents/pyproject.toml` and run `uv lock`.
