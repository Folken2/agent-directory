"""
ADK Agent Builder - designs agents with the user and builds them as complete,
production-ready projects on nuvel (https://github.com/Folken2/nuvel).

- Knowledge: nuvel's ADK skills, plus the official ADK docs over MCP.
- Building: nuvel's scaffolder stamps the production skeleton into a
  per-session workspace; the model writes the agent's prompt, tools and
  skills; nuvel validates; the project is handed over as a zip artifact.
- Running: with E2B_API_KEY set, the project is installed, imported and
  tested in a per-session E2B sandbox (sandbox.py), never on this server.
- Safety: nuvel's path_guard and exfil_guard on every tool call, and nuvel's
  plugins on the app (see nuvel_plugins.py).
"""

import logging
import pathlib

import nuvel.backends.adk
from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.skills import load_skill_from_dir
from google.adk.tools.mcp_tool.mcp_session_manager import (
    StdioConnectionParams,
    StdioServerParameters,
)
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from google.adk.tools.skill_toolset import SkillToolset
from nuvel.callbacks.path_guard import path_guard
from nuvel.guardrails.exfil_guard import exfil_guard

from . import sandbox
from .callbacks.blueprint_document import capture_blueprint
from .config.llm import FAST_MODEL
from .nuvel_plugins import builder_plugins
from .prompt.prompt import build_prompt_v3
from .tools import get_tools

logger = logging.getLogger(__name__)

# nuvel's ADK knowledge skills ship inside the nuvel package.
NUVEL_SKILLS_DIR = pathlib.Path(nuvel.backends.adk.__file__).parent / "skills"

# Canonical llms.txt lives on adk.dev (HTTP 200, no redirect).
# Do NOT use google.github.io/adk-docs/llms.txt — it 301-redirects and mcpdoc
# does not follow redirects by default, breaking fetch_docs.
_ADK_DOCS_LLMS_TXT = "AgentDevelopmentKit:https://adk.dev/llms.txt"

LANGUAGE_INSTRUCTION = (
    "Respond in whatever language the user writes in. Mirror their language "
    "exactly, including any mid-conversation switches.\n\n"
)


def _build_adk_docs_mcp_toolset() -> McpToolset:
    """Official ADK docs MCP server (mcpdoc over stdio, launched via uvx).

    Exposes `list_doc_sources` and `fetch_docs` so the agent can pull
    authoritative ADK documentation on demand alongside its bundled skills.
    Requires `uv` on PATH (already installed by the project Dockerfile).
    """
    return McpToolset(
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
                    _ADK_DOCS_LLMS_TXT,
                    "--transport",
                    "stdio",
                ],
            ),
            timeout=30.0,
        ),
    )


def _build_skill_toolset() -> SkillToolset | None:
    if not NUVEL_SKILLS_DIR.is_dir():
        logger.warning("nuvel skills directory not found: %s", NUVEL_SKILLS_DIR)
        return None

    skills = []
    for skill_dir in sorted(NUVEL_SKILLS_DIR.iterdir()):
        if not (skill_dir.is_dir() and (skill_dir / "SKILL.md").exists()):
            continue
        try:
            skills.append(load_skill_from_dir(skill_dir))
        except Exception as e:
            logger.warning("Failed to load skill %s: %s", skill_dir.name, e)

    if not skills:
        logger.warning("No skills loaded from %s", NUVEL_SKILLS_DIR)
        return None

    logger.info("Loaded %d nuvel ADK skill(s)", len(skills))
    return SkillToolset(skills=skills)


def _build_tools():
    tools = get_tools()
    skill_toolset = _build_skill_toolset()
    if skill_toolset:
        tools.append(skill_toolset)
    try:
        tools.append(_build_adk_docs_mcp_toolset())
    except Exception as e:
        logger.warning("Failed to attach adk-docs MCP toolset: %s", e)
    return tools


async def _instruction(ctx) -> str:
    return LANGUAGE_INSTRUCTION + build_prompt_v3(
        ctx.state, sandbox=sandbox.enabled(), preview=sandbox.preview_enabled()
    )


root_agent = Agent(
    model=FAST_MODEL,
    name="adk_agent_builder",
    description="Describe the agent you want and get a complete, production-ready Google ADK project built on nuvel: design, code, plugins, Dockerfile and tests, delivered as a zip.",
    instruction=_instruction,
    tools=_build_tools(),
    before_tool_callback=[path_guard, exfil_guard],
    after_model_callback=capture_blueprint,
)

# The App carries nuvel's plugins for the builder only. The server's own
# plugins (extra_plugins in run_adk.py) are appended after these.
app = App(name="adk_agent_builder", root_agent=root_agent, plugins=builder_plugins())
