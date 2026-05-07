# Repo Atlas

An ADK agent that ingests any public GitHub repository and produces a
**Mermaid diagram of its structure** plus a concise **overview** — purpose,
stack, structure, and entry points — all in a single turn.

## How it works

Three function tools hit the GitHub REST API directly (no HTML scraping):

| Tool | Purpose |
| ---- | ------- |
| `fetch_repo_meta(url)` | Repo description, language, stars, default branch, topics, license |
| `fetch_repo_tree(url)` | Recursive file tree, with lockfiles / build dirs / vendored deps pruned |
| `read_repo_file(url, path)` | Reads README, language manifest, or up to 2 entry-point files |

The agent walks: meta → tree → README + manifest → composes the response. The
chat UI auto-renders the ` ```mermaid ` fenced code block.

## Quick Start

```bash
# 1. Install dependencies (from the repo root)
uv sync --no-install-project

# 2. Add API keys to .env
OPENROUTER_API_KEY=your_key_here
GITHUB_TOKEN=ghp_your_token_here   # OPTIONAL — raises GitHub rate limit from 60/hr to 5000/hr
FAST_MODEL=openrouter/google/gemini-3-flash-preview   # optional

# 3. Run
adk web
```

**Get API keys:**

- [OpenRouter](https://openrouter.ai/keys) — for the LLM
- [GitHub token](https://github.com/settings/tokens) — optional but recommended for production

## Project Structure

```text
repo_atlas_agent/
├── agent.py                # Single LlmAgent with three function tools
├── config/
│   └── llm.py              # FAST_MODEL / REASONING_MODEL via OpenRouter
├── prompt/
│   └── prompt.py           # System prompt: workflow, output format, mermaid rules
├── tools/
│   └── github_api.py       # GitHub REST API client (httpx, no scraping)
├── metadata.json           # Directory card metadata
└── README.md
```

## Rate Limits

- **Without `GITHUB_TOKEN`**: 60 requests/hour per IP. Each agent run uses
  3-6 requests, so you'll hit the cap after ~10 invocations.
- **With `GITHUB_TOKEN`**: 5000 requests/hour. Set this in production.
- Private repos are not supported (no auth flow exposed).

## Why not Tavily / scraping?

GitHub already exposes a clean JSON API for everything we need. Scraping
github.com HTML would be slower, flakier, and break whenever GitHub
restructures their UI. The API path is faster, more reliable, and easier to
reason about.
