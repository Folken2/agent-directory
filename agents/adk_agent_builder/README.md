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
2. **Design**: it loads nuvel's architecture and skill-design skills, proposes the agents, tools, skills and nuvel options, and emits a **blueprint** (shown as a panel in the web UI; see `blueprint.py`). It asks before building.
3. **Build**: `scaffold_agent` → `write_file` for the prompt, SOUL.md, tools, skills, requirements, README and tests → `validate_agent` until clean → `package_agent`.
4. **Hand over**: a short summary plus `<name>.zip` in the chat.

## Tools

| Tool | What it does |
| --- | --- |
| `scaffold_agent` | Stamps nuvel's skeleton (`nuvel.backends.adk.scaffold`) with the chosen options; the project becomes the session's current project |
| `write_file`, `read_file`, `list_files` | Edit the current project; paths are relative to its root |
| `validate_agent` | nuvel's checks: required files, no `{{placeholders}}`, every Python file compiles, skills have a `SKILL.md` |
| `package_agent` | Validates, zips the project (no `.env`, no caches) and saves it as the `<name>.zip` artifact |
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

## Project structure

```text
adk_agent_builder/
├── agent.py             # root_agent (skills, tools, guards) and app (nuvel plugins)
├── nuvel_plugins.py     # nuvel plugin chain for the builder
├── workspace.py         # per-session workspace, limits, cleanup
├── tools/
│   ├── __init__.py      # get_tools()
│   └── project_tools.py # scaffold / write / read / list / validate / package
├── blueprint.py         # Blueprint model + ```blueprintjson parsing
├── callbacks/
│   └── blueprint_document.py  # moves the blueprint into session state
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

Tests: `python -m pytest tests/test_agent_builder.py tests/test_blueprint.py`.

## Customization

- **Model**: `FAST_MODEL` in `.env` or `config/llm.py`.
- **Prompt**: `prompt/prompt.py`. Prompts are versioned; add `PROMPT_V4` for substantive changes.
- **nuvel version**: bump the commit in `agents/pyproject.toml` and run `uv lock`.
