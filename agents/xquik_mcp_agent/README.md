# Xquik MCP Agent

An ADK sample agent that connects to the Xquik MCP server for X data search,
follower exports, monitors, webhooks, compose workflows, and giveaway draws.

## Setup

```bash
uv sync --no-install-project

OPENROUTER_API_KEY=your_model_key_here
XQUIK_API_KEY=your_xquik_api_key_here
FAST_MODEL=openrouter/google/gemini-3-flash-preview
```

## Run

```bash
adk web
```

## How It Works

The agent connects to `https://xquik.com/mcp` with an `Authorization` header
when `XQUIK_API_KEY` is set. The MCP server provides Xquik workflows for X data,
extractions, monitors, webhooks, compose actions, and giveaway draws.

## Example Prompts

- Search recent X posts about open source agent frameworks.
- Extract followers for an account and return the first page as JSON.
- Create a keyword monitor and explain the webhook event shape.
- Run a giveaway draw from this post URL after confirming the filters.

## References

- [Xquik MCP Docs](https://docs.xquik.com/mcp/overview)
- [Xquik MCP Server Card](https://xquik.com/.well-known/mcp/server-card.json)
- [Xquik Agent Skills Index](https://xquik.com/.well-known/agent-skills/index.json)
- [Source Repository](https://github.com/Xquik-dev/x-twitter-scraper)
