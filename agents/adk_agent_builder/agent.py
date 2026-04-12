"""
ADK Agent Builder - A specialist agent that helps users build ADK agents using ADK documentation
"""

## config imports
from .config.llm import FAST_MODEL
from .config.utils import before_agent_callback_update_tools

## prompt imports
from .prompt.prompt import prompt_v1

from google.adk.agents import Agent
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from mcp import StdioServerParameters

# The ADK docs MCP server uses stdio transport, so we use StdioConnectionParams.
#
# mcpdoc (langchain-ai/mcpdoc) only auto-allows the *host* of the llms.txt URL. Our index
# is on raw.githubusercontent.com, but every page link inside it is on adk.dev — so we must
# pass --allowed-domains https://adk.dev/ or fetch_docs rejects those URLs.
# See: https://github.com/langchain-ai/mcpdoc#note-security-and-domain-access-control
#
# Do NOT use google.github.io/adk-docs/llms.txt for the index: it 301-redirects (mcpdoc has
# follow_redirects off by default). Raw GitHub serves the same file with HTTP 200.
root_agent = Agent(
    model=FAST_MODEL,
    name="adk_agent_builder",
    description="Your guide to building agents with Google's Agent Development Kit. Get architecture advice, code examples, and best practices for single-agent and multi-agent systems — grounded in the latest ADK documentation.",
    instruction=prompt_v1,
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
                        "AgentDevelopmentKit:https://raw.githubusercontent.com/google/adk-docs/main/llms.txt",
                        "--allowed-domains",
                        "https://adk.dev/",
                        "--transport",
                        "stdio",
                    ],
                ),
            ),
        )
    ],
    before_agent_callback=before_agent_callback_update_tools,
)

