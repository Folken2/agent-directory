---
title: How to connect an MCP server to a Google ADK agent
seoTitle: ADK MCP Guide: Connect MCP Servers with McpToolset
description: Connect any MCP server to a Google ADK agent with McpToolset: stdio vs streamable HTTP, tool filtering, auth and common errors, with real agent code.
published: 2026-11-02
agents: exa_mcp_agent, mermaid_mcp_agent, xquik_mcp_agent
keywords: ADK MCP, McpToolset, MCPToolset, Google ADK, Agent Development Kit, Model Context Protocol, StreamableHTTPConnectionParams, StdioConnectionParams
---

An MCP (Model Context Protocol) server is a process or web service that publishes a list of tools. Google's Agent Development Kit (ADK) can connect to one with a single object, `McpToolset`, and hand every tool on that server to your agent. You don't write a wrapper per tool: ADK asks the server for its tool list, turns each tool's name, description and JSON schema into a function declaration for the model, and forwards the model's calls back to the server.

This guide uses the code of three agents you can try on this site: a web research agent on Exa's MCP server, a diagram agent on Mermaid Chart's, and an X (Twitter) data agent on Xquik's. Everything below was checked against **google-adk 2.10.0** with **mcp 1.30**.

## The short version

Install ADK with its MCP extra. In ADK 2.x the `mcp` package is optional, so a plain `pip install google-adk` is not enough:

```bash
pip install "google-adk[mcp]"
```

Then add an `McpToolset` to the agent's `tools`. This is the whole Xquik agent, minus its description and the local imports of `FAST_MODEL` and `prompt_v1`:

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

Run it with `adk web` and the agent can call every tool the Xquik server publishes. The rest of this guide covers the choices you make inside that `McpToolset(...)` call.

## McpToolset or MCPToolset?

Both names exist. `McpToolset` is the current one. `MCPToolset` is a subclass kept for old code; it works but raises a `DeprecationWarning` ("MCPToolset class is deprecated, use `McpToolset` instead"). Use `McpToolset` in new code.

You can import it, and the connection classes, from either path:

```python
from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams, StreamableHTTPConnectionParams
# or, as the agents on this site do:
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
```

An `McpToolset` can sit next to ordinary Python function tools in the same `tools` list. The Repo Atlas agent mixes four of its own functions with the Mermaid Chart server:

```python
tools=[
    fetch_repo_meta,
    fetch_repo_tree,
    read_repo_file,
    fetch_recent_releases,
    McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url="https://mcp.mermaidchart.com/mcp",
        ),
    ),
],
```

## Choose a connection: streamable HTTP or stdio

`connection_params` decides how ADK reaches the server. There are three options:

| Connection | Use it for | Key arguments |
| --- | --- | --- |
| `StreamableHTTPConnectionParams` | Hosted servers with an `https://…/mcp` URL | `url`, `headers`, `timeout=5.0`, `sse_read_timeout=300.0` |
| `StdioConnectionParams` | Local servers you start as a subprocess (`npx`, `uvx`, `python`) | `server_params`, `timeout=5.0` |
| `SseConnectionParams` | Older servers that only speak the legacy HTTP+SSE transport | `url`, `headers` |

Prefer streamable HTTP when the provider hosts the server: nothing to install, nothing to keep running next to your agent. All three agents in this guide use it.

### Remote servers over streamable HTTP

Pass the server's URL, and its auth headers if it needs any. The Mermaid Chart agent:

```python
# Mermaid Chart's MCP server rejects unauthenticated requests (HTTP 401), so it
# needs a Mermaid Chart API token (Settings -> API Tokens) as a Bearer header.
MERMAID_CHART_API_KEY = os.getenv("MERMAID_CHART_API_KEY", "").strip()
MERMAID_MCP_HEADERS = (
    {"Authorization": f"Bearer {MERMAID_CHART_API_KEY}"}
    if MERMAID_CHART_API_KEY
    else {}
)

McpToolset(
    connection_params=StreamableHTTPConnectionParams(
        url="https://mcp.mermaidchart.com/mcp",
        headers=MERMAID_MCP_HEADERS,
    ),
)
```

`timeout` (default 5 seconds) bounds how long ADK waits on the server. `sse_read_timeout` (default 300 seconds) is how long a single streamed response may stay open, which matters for slow tools such as deep research jobs.

### Local servers over stdio

With stdio, ADK starts the server as a child process and talks to it over stdin/stdout. The agent builder on this site uses this to load the official ADK documentation through `mcpdoc`:

```python
from google.adk.tools.mcp_tool.mcp_session_manager import (
    StdioConnectionParams,
    StdioServerParameters,
)
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="uvx",
            # Pin the tool's environment: uvx resolves at runtime, and
            # mcpdoc 0.0.10 uses the mcp 1.x API (FastMCP), removed in mcp 2.
            args=[
                "--from",
                "mcpdoc==0.0.10",
                "--with",
                "mcp>=1.0,<2",
                "mcpdoc",
                "--urls",
                "AgentDevelopmentKit:https://adk.dev/llms.txt",
                "--transport",
                "stdio",
            ],
        ),
        timeout=30.0,
    ),
)
```

Three things in that snippet are worth copying:

- **Pin the server version.** `uvx` and `npx -y` resolve packages when the agent starts. Without a pin, a new release of the server can break your agent overnight.
- **Raise the timeout.** The first `uvx` or `npx` run downloads packages, which easily takes longer than the 5-second default. The builder uses 30 seconds.
- **Make sure the command exists where the agent runs.** `uvx` must be on the `PATH` of your container, not just your laptop. The project's Dockerfile installs `uv` for this reason.

## Pass API keys and other secrets

Read secrets from the environment, never from source code. How you hand them to the server depends on the connection.

**HTTP headers.** Most hosted servers take a bearer token, as in the Mermaid Chart and Xquik agents above. Both build the header only when the key is set, so the agent still starts locally without it (and the server's 401 tells you what is missing).

**Query parameters.** Some hosted servers read the key from the URL. Exa's server does, and it also takes the list of tools to enable:

```python
EXA_API_KEY = os.getenv("EXA_API_KEY")

McpToolset(
    connection_params=StreamableHTTPConnectionParams(
        url=f"https://mcp.exa.ai/mcp?tools={ALL_EXA_TOOLS}&exaApiKey={EXA_API_KEY}",
    ),
)
```

A key in a URL is easier to leak into logs than a header, so use a header whenever the server accepts one, and keep URLs like this out of your own log lines.

**Environment variables for stdio servers.** This one catches people: a stdio server does **not** inherit your agent's environment. The `mcp` client only passes a short safe list (`PATH`, `HOME`, `USER`, `SHELL`, `TERM` and a few others). If the server needs a token, pass it explicitly with `env`:

```python
StdioServerParameters(
    command="npx",
    args=["-y", "some-mcp-server@1.2.3"],
    env={"SERVICE_API_KEY": os.environ["SERVICE_API_KEY"]},
)
```

The `mcp` client merges your `env` on top of the safe defaults, so `PATH` keeps working.

**Per-user credentials.** When each user brings their own token, use `header_provider` instead of fixed `headers`. ADK calls it with a read-only context before talking to the server, and you can read the session state from it:

```python
from google.adk.agents.readonly_context import ReadonlyContext


def user_auth_headers(ctx: ReadonlyContext) -> dict[str, str]:
    token = ctx.state.get("user:service_token")
    return {"Authorization": f"Bearer {token}"} if token else {}


McpToolset(
    connection_params=StreamableHTTPConnectionParams(url="https://example.com/mcp"),
    header_provider=user_auth_headers,
)
```

The provider may also be `async`. For OAuth flows, `McpToolset` takes `auth_scheme` and `auth_credential` like other ADK authenticated tools.

## Filter which tools the agent sees

A server may publish dozens of tools. Every tool you expose costs prompt tokens and gives the model one more wrong choice to make, so expose only what the agent needs.

**Ask the server.** Some servers let you choose tools when you connect. The Exa agent turns on all nine of Exa's tools through the `tools` query parameter:

```python
# Enable all Exa tools
# Default: web_search_exa, get_code_context_exa, company_research_exa
# Optional: web_search_advanced_exa, deep_search_exa, crawling_exa,
#           linkedin_search_exa, deep_researcher_start, deep_researcher_check
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

**Filter in ADK.** For any server, pass `tool_filter`, either as a list of tool names:

```python
McpToolset(
    connection_params=StreamableHTTPConnectionParams(url=f"https://mcp.exa.ai/mcp?exaApiKey={EXA_API_KEY}"),
    tool_filter=["web_search_exa", "crawling_exa"],  # names as the server publishes them
)
```

or as a function that receives each tool and the read-only context and returns `True` to keep it. That lets you decide per user or per session:

```python
def read_only_tools(tool, ctx=None) -> bool:
    return not tool.name.startswith(("create_", "delete_", "update_"))


McpToolset(connection_params=..., tool_filter=read_only_tools)
```

**Avoid name clashes.** If two servers both publish a `search` tool, give each toolset a `tool_name_prefix`. With `tool_name_prefix="exa"` the model sees `exa_search`. ADK applies `tool_filter` first, to the original names, so keep using the server's names in the filter.

**Ask before side effects.** `require_confirmation=True` makes ADK ask the user before each call, which is a good default for tools that post, send or delete. It also accepts a function, to confirm only some calls.

## Telling the model about the tools

You don't have to list MCP tools in your prompt: ADK sends each tool's name, description and argument schema to the model with every request. The Exa and Mermaid agents go one step further and append a readable tool list to the instruction from a `before_agent_callback`, because the toolset can only list its tools once the server connection is up:

```python
root_agent = Agent(
    model=FAST_MODEL,
    name="exa_mcp_agent",
    instruction=LANGUAGE_INSTRUCTION + prompt_v1,
    tools=[McpToolset(connection_params=StreamableHTTPConnectionParams(url=...))],
    before_agent_callback=before_agent_callback_update_tools,
)
```

The callback awaits `toolset.get_tools()` and writes `- **name**: description` lines into the instruction. It is optional. Reach for it when the model ignores a tool it should use, or to add guidance on when to pick which tool; otherwise the schemas are enough.

## Handle tool errors

MCP tools fail like any other tool: bad arguments, rate limits, invalid input. The model sees the error in the tool result and can usually retry. The Mermaid agent makes this explicit with an `after_tool_callback` that counts failures in session state and stops after three:

```python
# Abbreviated from mermaid_mcp_agent/callbacks/validation_callback.py
def after_tool_validation_callback(tool, args, tool_response, tool_context):
    ...  # find `error` in tool_response
    if error:
        retry_count = tool_context.state.get("mermaid_retry_count", 0)
        if retry_count < MAX_RETRIES:
            tool_context.state["mermaid_retry_count"] = retry_count + 1
            tool_context.state["mermaid_last_error"] = str(error)
            # Return None to allow the error to propagate to the LLM
            return None
        return {
            "error": f"Failed to generate valid Mermaid diagram after {MAX_RETRIES} attempts. Last error: {error}",
            "give_up": True,
        }
```

Returning `None` passes the server's response through unchanged; returning a dict replaces it. Keep the parameter names exactly as ADK expects them (`tool`, `args`, `tool_response`, `tool_context`); `tool_response` is not called `result`.

## Connection lifecycle and performance

- **ADK opens and pools the sessions.** You don't call `connect()`. The `Runner` closes every toolset when it closes, and you can call `await toolset.close()` yourself in scripts.
- **The tool list is fetched on every turn** by default. If the server's tools rarely change, set `tool_list_cache_ttl_seconds=300` to skip that round trip. ADK doesn't listen for the server's "tools changed" notification, so a cached list only refreshes when the cache expires.
- **ADK sorts the tools by name**, so the order the model sees is stable across turns, which keeps prompt caching effective.
- **Need MCP resources too?** `use_mcp_resources=True` adds a `load_mcp_resource` tool so the agent can read the server's resources, not just call its tools.

## Common errors

**`ImportError` or `No module named 'mcp'`.** The MCP extra isn't installed. Run `pip install "google-adk[mcp]"`. ADK 2.10 needs `mcp` 1.24 or newer.

**`ConnectionError: Failed to create MCP session: …`.** ADK could not reach or start the server. For HTTP, check the URL (most servers live at `/mcp`) and your network. For stdio, run the exact `command` and `args` in a terminal: a missing `npx`/`uvx`, a typo in the package name or a crash on start all end here. If the server is just slow to start, raise `timeout`.

**`ConnectionError: Failed to create MCP session: … Client error '401 Unauthorized'`.** The server wants credentials. This is exactly what the Mermaid Chart server returns when `MERMAID_CHART_API_KEY` is empty. Check the header name and the `Bearer ` prefix, and that the environment variable is actually set where the agent runs, not just in your local `.env`. A 403 means the key is valid but lacks access.

**The stdio server starts but says its API key is missing.** It didn't inherit your environment. Pass the variable in `StdioServerParameters(env=...)`, as shown above.

**The agent never calls a tool you expected.** Check the tool's exact name (print `[t.name for t in await toolset.get_tools()]`), that `tool_filter` doesn't drop it, and that its description tells the model when to use it. A warning that a tool was skipped because it "collides with a reserved ADK framework tool name" means the server uses a name ADK reserves; that one tool is dropped and the rest still load.

**A server written for `mcp` 1.x breaks after an upgrade.** `mcp` 2.x renamed parts of its server API. Pin the server's environment, as the builder does with `--with "mcp>=1.0,<2"`, or pin `mcp<2` in your own project if you run servers in-process.

## Try it

Open one of the three agents and ask it something that needs its server: a research question for the [Exa Research Assistant](/agents/exa_mcp_agent), a flowchart for the [Diagram Creator](/agents/mermaid_mcp_agent) on Mermaid Chart, or a search of recent posts for the [Xquik MCP Agent](/agents/xquik_mcp_agent). Each agent page links to its full source on GitHub, prompt and callbacks included, and has a button to try it in chat without an account.
