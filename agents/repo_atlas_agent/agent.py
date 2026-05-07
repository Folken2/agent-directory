"""
Repo Atlas — ingests any public GitHub repository and produces a Mermaid
diagram of its structure plus a concise overview.

The agent combines two tool layers:
  1. GitHub function tools (httpx → REST API) for repo introspection. Optional
     GITHUB_TOKEN env var raises the rate limit from 60/hr to 5000/hr.
  2. Mermaid MCP toolset (mcp.mermaidchart.com) for create / validate / render.
     A validation callback auto-retries up to 3 times on Mermaid syntax errors.
"""

from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

from .callbacks import after_tool_validation_callback
from .config.llm import FAST_MODEL
from .config.utils import before_agent_callback_update_tools
from .prompt.prompt import prompt_v0
from .tools import fetch_repo_meta, fetch_repo_tree, read_repo_file

root_agent = LlmAgent(
    model=FAST_MODEL,
    name="repo_atlas_agent",
    description=(
        "Ingests any public GitHub repository and produces a Mermaid diagram "
        "of its structure plus a concise overview — purpose, stack, layout, "
        "entry points, and use cases — all in a single turn."
    ),
    instruction=prompt_v0,
    tools=[
        fetch_repo_meta,
        fetch_repo_tree,
        read_repo_file,
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://mcp.mermaidchart.com/mcp",
            ),
        ),
    ],
    before_agent_callback=before_agent_callback_update_tools,
    after_tool_callback=after_tool_validation_callback,
)
