# Deep Research Agent

An autonomous multi-agent research pipeline built on Google ADK. Where the
Tavily MCP Agent runs single-shot searches, this agent iterates: it
decomposes a question into a plan, gathers evidence with Tavily, critiques
its own coverage, and composes a cited report — all in one turn.

## Architecture

```
SequentialAgent: deep_research_agent
  ├─ planner             (decomposes question -> research_plan)
  ├─ research_loop       (LoopAgent, max_iterations=3)
  │     ├─ researcher    (Tavily MCP search + extract -> findings)
  │     └─ critic        (gap analysis -> calls exit_loop when DONE)
  └─ writer              (composes final_report with citations)
```

The Critic exits the loop early via the `exit_loop` tool once coverage is
sufficient. Otherwise the loop runs up to 3 iterations.

## Quick Start

```bash
# 1. Install dependencies (from the repo root)
uv sync --no-install-project

# 2. Add API keys to .env
OPENROUTER_API_KEY=your_key_here
TAVILY_API_KEY=your_key_here
FAST_MODEL=openrouter/google/gemini-3-flash-preview   # optional

# 3. Run
adk web
```

**Get API keys:**

- [OpenRouter](https://openrouter.ai/keys) — for the LLM
- [Tavily](https://tavily.com/) — for web search and content extraction

## Project Structure

```text
deep_research_agent/
├── agent.py                # Sub-agents + SequentialAgent[planner, LoopAgent, writer]
├── config/
│   ├── llm.py              # FAST_MODEL / REASONING_MODEL via OpenRouter
│   └── utils.py            # Date helper + MCP tool-injection callback
├── prompt/
│   └── prompts.py          # planner / researcher / critic / writer prompts
├── tools/
│   └── exit_loop.py        # Loop-termination tool the Critic calls
├── metadata.json           # Directory card metadata
└── README.md
```

## State Flow

The four sub-agents communicate exclusively via session state, written through
each sub-agent's `output_key`:

| Key             | Written by  | Read by                     |
| --------------- | ----------- | --------------------------- |
| `research_plan` | planner     | researcher, critic, writer  |
| `findings`      | researcher  | researcher (next iter), critic, writer |
| `critique`      | critic      | researcher (next iter)      |
| `final_report`  | writer      | (terminal output)            |

State placeholders inside the prompts (`{research_plan}`, `{findings}`, etc.)
are filled automatically by ADK before each sub-agent runs. Optional fields
(only present from iteration 2 onward) use the `{key?}` form.

## Differentiation from `tavily_mcp_agent`

| | `tavily_mcp_agent` | `deep_research_agent` |
|--|--|--|
| Architecture | Single LlmAgent | SequentialAgent + LoopAgent |
| Pattern | Power tool — you ask, it queries | Autonomous researcher — you ask, it iterates |
| Tool calls | 1-3 per turn | 5-15 per turn across iterations |
| Output | Direct answer + 4 sources | Multi-section cited report |
| Best for | Quick lookups, single-page extraction | Comparative analysis, deep investigations |

## Tweaking the Loop

In `agent.py`:

- `max_iterations=3` — bump to 5 for harder questions, drop to 2 for speed
- Switch any sub-agent's `model=FAST_MODEL` to `REASONING_MODEL` (Gemini 3 Pro)
  for higher-quality planning, criticism, or writing at the cost of latency
  and tokens. Planner and Critic benefit most from the upgrade.
