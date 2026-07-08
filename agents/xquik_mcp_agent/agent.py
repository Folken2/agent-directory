"""
Xquik MCP agent for X data and automation workflows.
"""

import os

from google.adk.agents import Agent
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

from .config.llm import FAST_MODEL
from .prompt.prompt import prompt_v1

XQUIK_API_KEY = os.getenv("XQUIK_API_KEY")
XQUIK_MCP_HEADERS = (
    {"Authorization": f"Bearer {XQUIK_API_KEY}"}
    if XQUIK_API_KEY
    else {}
)

root_agent = Agent(
    model=FAST_MODEL,
    name="xquik_mcp_agent",
    description=(
        "Connects to Xquik MCP for X search, extraction, monitoring, "
        "webhook, compose, and giveaway workflows."
    ),
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
