---
title: How to connect an MCP server to a Google ADK agent
seoTitle: ADK MCP Guide: Connect MCP Servers with McpToolset
description: Connect any MCP server to a Google ADK agent with McpToolset: stdio vs streamable HTTP, tool filtering, auth and common errors, with real agent code.
published: 2026-11-02
agents: exa_mcp_agent, mermaid_mcp_agent, xquik_mcp_agent
keywords: ADK MCP, McpToolset, MCPToolset, Google ADK, Agent Development Kit, Model Context Protocol, StreamableHTTPConnectionParams, StdioConnectionParams
---

An MCP (Model Context Protocol) server publishes a list of tools. Google's Agent Development Kit (ADK) connects to one with a single object, `McpToolset`: it asks the server for its tools, turns each one's name, description and JSON schema into a function declaration for the model, and forwards the model's calls back to the server. You don't write a wrapper per tool.

The code below comes from three agents you can try on this site: a research agent on Exa's MCP server, a diagram agent on Mermaid Chart's and an X (Twitter) data agent on Xquik's. Everything was checked against **google-adk 2.10.0** with **mcp 1.30**.

## The short version

Install ADK with its MCP extra. In ADK 2.x the `mcp` package is optional, so a plain `pip install google-adk` is not enough:

```bash
pip install "google-adk[mcp]"
```

Then add an `McpToolset` to the agent's `tools`. This is the Xquik agent, minus its description and the local imports of `FAST_MODEL` and `prompt_v1`:

```python
import os

from google.adk.agents import Agent
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

XQUIK_API_KEY = os.getenv("XQUIK_API_KEY")
XQUIK_MCP_HEADERS = (
    {"Authorization": f"Bearer {XQUIK_API_KEY}"}
    if XQUIK_API_KEY
    else {}
)

root_agent = Agent(
    model=FAST_MODEL,
    name="xquik_mcp_agent",
    instruction=prompt_v1,
    tools=[
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://xquik.com/mcp",
                headers=XQUIK_MCP_HEADERS,
            ),
        )
    ],
)
```

Run it with `adk web` and the agent can call every tool the Xquik server publishes. An `McpToolset` can also sit next to plain Python function tools in the same list; the Repo Atlas agent mixes four of its own functions with the Mermaid Chart server.

## McpToolset or MCPToolset?

Use `McpToolset`. `MCPToolset` is a subclass kept for old code: it still works but raises a `DeprecationWarning` ("MCPToolset class is deprecated, use `McpToolset` instead"). Both, and the connection classes, can also be imported from `google.adk.tools.mcp_tool`.

## Choose a connection: streamable HTTP or stdio

`connection_params` decides how ADK reaches the server:

| Connection | Use it for | Key arguments |
| --- | --- | --- |
| `StreamableHTTPConnectionParams` | Hosted servers with an `https://…/mcp` URL | `url`, `headers`, `timeout=5.0`, `sse_read_timeout=300.0` |
| `StdioConnectionParams` | Local servers started as a subprocess (`npx`, `uvx`, `python`) | `server_params`, `timeout=5.0` |
| `SseConnectionParams` | Older servers on the legacy HTTP+SSE transport | `url`, `headers` |

**Streamable HTTP** is the simplest choice when the provider hosts the server: nothing to install or keep running. All three agents in this guide use it, as in the snippet above. `sse_read_timeout` is how long one streamed response may stay open, which matters for slow tools such as deep research jobs.

**Stdio** starts the server as a child process and talks to it over stdin/stdout. The agent builder on this site loads the ADK docs through `mcpdoc` this way:

```python
McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="uvx",
            args=[
                "--from",
                "mcpdoc==0.0.10",
                "--with",
                "mcp>=1.0,<2",
                "mcpdoc",
                "--urls",
                _ADK_DOCS_LLMS_TXT,
                "--transport",
                "stdio",
            ],
        ),
        timeout=30.0,
    ),
)
```

Three habits worth copying from it. Pin the server version, because `uvx` and `npx -y` resolve packages at startup and a new release can break your agent overnight. Raise `timeout`: the first run downloads packages and easily takes longer than the 5-second default. And make sure the command (`uvx` here) exists where the agent runs, not just on your laptop.

## Pass API keys and other secrets

Read secrets from the environment, never from source. Most hosted servers take a bearer header, as in the Xquik snippet; it builds the header only when the key is set, so the agent still starts without it, and the server's 401 tells you what is missing. Mermaid Chart's server works the same way with `MERMAID_CHART_API_KEY`.

Some servers read the key from the URL instead. Exa's does:

```python
McpToolset(
    connection_params=StreamableHTTPConnectionParams(
        url=f"https://mcp.exa.ai/mcp?tools={ALL_EXA_TOOLS}&exaApiKey={EXA_API_KEY}",
    ),
)
```

A key in a URL leaks into logs more easily than a header, so prefer headers when the server accepts them.

Two cases need more than a fixed header:

- **Stdio servers don't inherit your environment.** The `mcp` client passes only a short safe list (`PATH`, `HOME`, `USER`, `SHELL`, `TERM` and a few more). Pass the server's token explicitly with `StdioServerParameters(env={...})`; it is merged on top of those defaults.
- **Per-user tokens.** Pass `header_provider`, a function (sync or async) that receives a `ReadonlyContext` and returns a headers dict. Read the user's token from `ctx.state`. For OAuth, `McpToolset` also takes `auth_scheme` and `auth_credential`.

## Filter which tools the agent sees

Every exposed tool costs prompt tokens and gives the model one more wrong choice, so expose only what the agent needs. Some servers let you choose at connect time. Exa takes a `tools` query parameter, and the Exa agent enables nine:

```python
ALL_EXA_TOOLS = (
    "web_search_exa,"
    "web_search_advanced_exa,"
    "get_code_context_exa,"
    "deep_search_exa,"
    "crawling_exa,"
    "company_research_exa,"
    "linkedin_search_exa,"
    "deep_researcher_start,"
    "deep_researcher_check"
)
```

For any server, filter in ADK with `tool_filter`: either a list of names, such as `tool_filter=["web_search_exa", "crawling_exa"]`, or a function `(tool, readonly_context) -> bool` to decide per user or session.

Two related options. `tool_name_prefix="exa"` renames tools to `exa_<name>` so two servers can't clash; the filter still uses the server's original names, because ADK filters before it adds the prefix. And `require_confirmation=True` makes ADK ask the user before each call, a good default for tools that post, send or delete.

## Common errors

**`ImportError` or `No module named 'mcp'`.** The MCP extra isn't installed. Run `pip install "google-adk[mcp]"`; ADK 2.10 needs `mcp` 1.24 or newer.

**`ConnectionError: Failed to create MCP session: …`.** ADK couldn't reach or start the server. For HTTP, check the URL (most servers live at `/mcp`). For stdio, run the exact `command` and `args` in a terminal: a missing `uvx`/`npx`, a misspelt package or a crash on start all end here. If the server is just slow to start, raise `timeout`.

**`Failed to create MCP session: … Client error '401 Unauthorized'`.** The server wants credentials. This is exactly what Mermaid Chart returns when `MERMAID_CHART_API_KEY` is empty. Check the header name, the `Bearer ` prefix, and that the variable is set where the agent runs, not just in your local `.env`. A 403 means the key works but lacks access.

**The stdio server starts but says its API key is missing.** It didn't inherit your environment; pass the key in `StdioServerParameters(env=...)`.

**The agent never calls a tool you expected.** Print `[t.name for t in await toolset.get_tools()]` to see the real names, check `tool_filter` doesn't drop it, and make sure its description says when to use it. A warning that a tool "collides with a reserved ADK framework tool name" means that one tool was skipped; the rest still load.

**A tool call fails.** The model sees the error in the tool result and usually retries with new arguments. To cap retries, add an `after_tool_callback(tool, args, tool_response, tool_context)`: the Mermaid agent counts failures in `tool_context.state` and returns a `give_up` error after three. Returning `None` passes the response through; returning a dict replaces it.

**Slow turns.** ADK lists the server's tools on every turn. If they rarely change, set `tool_list_cache_ttl_seconds=300`. You never call `connect()` or `close()` yourself in an agent: ADK pools the sessions and the `Runner` closes every toolset when it closes.

**A server written for `mcp` 1.x breaks after an upgrade.** `mcp` 2.x renamed parts of its server API. Pin the server's environment, as the builder does with `--with "mcp>=1.0,<2"`.

## Try it

Open one of the three agents and ask it something that needs its server: a research question for the [Exa Research Assistant](/agents/exa_mcp_agent), a flowchart for the [Diagram Creator](/agents/mermaid_mcp_agent) on Mermaid Chart, or a search of recent posts for the [Xquik MCP Agent](/agents/xquik_mcp_agent). Each agent page links to its full source on GitHub and has a button to try it in chat without an account.
