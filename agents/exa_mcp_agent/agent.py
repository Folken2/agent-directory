"""
Simple Agent with Exa MCP Capabilities
"""

## config imports
from .config.llm import FAST_MODEL
from .config.utils import (
    make_instruction_with_tools,
    before_agent_callback_update_tools,
)

## prompt imports
from .prompt.prompt import prompt_v1

import os
from google.adk.agents import Agent
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

EXA_API_KEY = os.getenv("EXA_API_KEY")

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

# Create agent with base instruction
# Use before_agent_callback to dynamically add tools at runtime when MCP is initialized
root_agent = Agent(
    model=FAST_MODEL,
    name="exa_mcp_agent",
    description="Deep research across the web, code, companies, and people. Searches GitHub repos, crawls URLs, finds LinkedIn profiles, and generates comprehensive research reports with citations.",
    instruction=prompt_v1,
    tools=[
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url=f"https://mcp.exa.ai/mcp?tools={ALL_EXA_TOOLS}&exaApiKey={EXA_API_KEY}",
            ),
        )
    ],
    before_agent_callback=before_agent_callback_update_tools,
)

# Try to add tools synchronously during initialization (may fail if MCP not ready)
# The callback will handle it at runtime if this fails
try:
    root_agent.instruction = make_instruction_with_tools(root_agent)
except Exception as e:
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"Could not extract tools during initialization: {e}")
    logger.info("Tools will be added at runtime via callback")

