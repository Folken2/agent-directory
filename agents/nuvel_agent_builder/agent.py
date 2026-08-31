"""
Nuvel Agent Builder — a meta-agent that creates production-ready ADK agents
using the Nuvel CLI toolkit. Standalone mode: introduces the Nuvel Agent Builder
and describes its capabilities. When deployed as a full Nuvel backend, it can
scaffold, iterate, and publish agents directly.
"""

from google.adk.agents import Agent as LlmAgent

from .config.llm import FAST_MODEL
from .prompt.prompt import prompt_v1

root_agent = LlmAgent(
    model=FAST_MODEL,
    name="nuvel_agent_builder",
    description="Build custom ADK agents from natural language descriptions. Powered by Nuvel — scaffolds, iterates, and publishes production-ready agents with Composio, gateways, persona, and more.",
    instruction=prompt_v1,
)