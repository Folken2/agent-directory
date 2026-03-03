"""
ADK Agent Builder - A specialist agent that helps users build ADK agents using ADK documentation
"""

## config imports
from .config.llm import FAST_MODEL
from .config.utils import before_agent_callback_update_tools

## prompt imports
from .prompt.prompt import prompt_v0

from google.adk.agents import Agent
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from mcp import StdioServerParameters

# The ADK docs MCP server uses stdio transport, so we use StdioConnectionParams
# This matches the configuration in mcp.json which uses:
# command: "uvx"
# args: ["--from", "mcpdoc", "mcpdoc", "--urls", "AgentDevelopmentKit:https://google.github.io/adk-docs/llms.txt", "--transport", "stdio"]
root_agent = Agent(
    model=FAST_MODEL,
    name="adk_agent_builder",
    instruction=prompt_v0,
    tools=[
        McpToolset(
            connection_params=StdioConnectionParams(
                server_params=StdioServerParameters(
                    command="uvx",
                    args=[
                        "--from",
                        "mcpdoc",
                        "mcpdoc",
                        "--urls",
                        "AgentDevelopmentKit:https://google.github.io/adk-docs/llms.txt",
                        "--transport",
                        "stdio",
                    ],
                ),
            ),
        )
    ],
    before_agent_callback=before_agent_callback_update_tools,
)

