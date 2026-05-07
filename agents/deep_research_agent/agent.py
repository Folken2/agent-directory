"""
Deep Research Agent — a multi-agent ADK pipeline that decomposes a research
question, iteratively gathers evidence with Tavily, critiques coverage, and
composes a cited report.

Architecture:

    SequentialAgent: deep_research_agent
      ├─ planner             (LlmAgent)            -> writes state["research_plan"]
      ├─ research_loop       (LoopAgent, max_iterations=3)
      │     ├─ researcher    (LlmAgent + Tavily MCP)  -> writes state["findings"]
      │     └─ critic        (LlmAgent + exit_loop)   -> writes state["critique"]
      └─ writer              (LlmAgent)            -> writes state["final_report"]

The Critic exits the loop early via `exit_loop` (sets
`tool_context.actions.escalate = True`) once coverage is sufficient. Otherwise
the loop runs up to 3 iterations and the Writer composes the report from
whatever findings exist.
"""

import os

from google.adk.agents import LlmAgent, LoopAgent, SequentialAgent
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

from .config.llm import FAST_MODEL
from .config.utils import before_agent_callback_update_tools
from .prompt.prompts import (
    critic_prompt,
    planner_prompt,
    researcher_prompt,
    writer_prompt,
)
from .tools.exit_loop import exit_loop

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")


# -----------------------------------------------------------------------------
# Sub-agents
# -----------------------------------------------------------------------------
planner = LlmAgent(
    model=FAST_MODEL,
    name="planner",
    description="Decomposes the user's research question into a structured plan with subqueries and success criteria.",
    instruction=planner_prompt,
    output_key="research_plan",
)

researcher = LlmAgent(
    model=FAST_MODEL,
    name="researcher",
    description="Executes the research plan using Tavily web search and content extraction, building cited findings.",
    instruction=researcher_prompt,
    tools=[
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://mcp.tavily.com/mcp/",
                headers={"Authorization": f"Bearer {TAVILY_API_KEY}"},
            ),
        )
    ],
    before_agent_callback=before_agent_callback_update_tools,
    output_key="findings",
)

critic = LlmAgent(
    model=FAST_MODEL,
    name="critic",
    description="Reviews findings against the plan; signals DONE via exit_loop or flags specific gaps for another iteration.",
    instruction=critic_prompt,
    tools=[exit_loop],
    output_key="critique",
)

writer = LlmAgent(
    model=FAST_MODEL,
    name="writer",
    description="Composes the final cited markdown report from the accumulated findings.",
    instruction=writer_prompt,
    output_key="final_report",
)


# -----------------------------------------------------------------------------
# Orchestration
# -----------------------------------------------------------------------------
research_loop = LoopAgent(
    name="research_loop",
    description="Iterates Researcher → Critic until coverage is sufficient or max_iterations is reached.",
    sub_agents=[researcher, critic],
    max_iterations=3,
)

root_agent = SequentialAgent(
    name="deep_research_agent",
    description=(
        "Autonomous deep-research pipeline. Decomposes a question into a plan, "
        "iteratively gathers evidence with Tavily, critiques coverage, and "
        "composes a cited markdown report — all in one turn."
    ),
    sub_agents=[planner, research_loop, writer],
)
