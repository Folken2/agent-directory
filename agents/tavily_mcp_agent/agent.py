"""
Simple Agent with Tavily's McP capabilites to search the web and extract information from websites.
"""

## adk imports
from google.adk.agents import LlmAgent

## config imports
from .config.llm import FAST_MODEL
from .config.utils import before_agent_callback_update_tools

## prompt imports
from .prompt.prompt import prompt_v2

from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
import os

# Get API key from environment
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

root_agent = LlmAgent(
    model=FAST_MODEL,
    name="tavily_mcp_agent",
    description="Extract and analyze live web content with precision. Search, crawl, and map websites to gather competitive intelligence, monitor pricing, and compile market research — always with source citations.",
    instruction=prompt_v2,
    tools=[
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://mcp.tavily.com/mcp/",
                headers={
                    "Authorization": f"Bearer {TAVILY_API_KEY}",
                },
            ),
        )
    ],
    before_agent_callback=before_agent_callback_update_tools,
)

