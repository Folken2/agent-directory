"""
Mermaid MCP Agent with Validation Feedback Loop
"""

## config imports
from .config.llm import FAST_MODEL
from .config.utils import before_agent_callback_update_tools

## prompt imports
from .prompt.prompt import prompt_v1

## callback imports
from .callbacks import after_tool_validation_callback

from google.adk.agents import Agent
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

LANGUAGE_INSTRUCTION = (
    "Respond in whatever language the user writes in. Mirror their language "
    "exactly, including any mid-conversation switches.\n\n"
)


root_agent = Agent(
    model=FAST_MODEL,
    name="mermaid_mcp_agent",
    description="Create professional diagrams from plain language. Supports flowcharts, sequence diagrams, architecture maps, Gantt charts, C4 models, mindmaps, and more — rendered as high-quality images with editable code.",
    instruction=LANGUAGE_INSTRUCTION + prompt_v1,
    tools=[
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://mcp.mermaidchart.com/mcp",
            ),
        )
    ],
    before_agent_callback=before_agent_callback_update_tools,
    after_tool_callback=after_tool_validation_callback,
)

