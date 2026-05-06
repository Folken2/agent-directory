"""
ADK Agent Builder - A specialist agent that helps users build ADK agents,
grounded in a curated set of ADK skills shipped alongside the agent.
"""

import logging
import pathlib

from google.adk.agents import Agent
from google.adk.skills import load_skill_from_dir
from google.adk.tools.skill_toolset import SkillToolset

from .config.llm import FAST_MODEL
from .config.utils import before_agent_callback_update_tools
from .prompt.prompt import prompt_v1

logger = logging.getLogger(__name__)

_SKILLS_DIR = pathlib.Path(__file__).parent / "skills"


def _build_skill_toolset() -> SkillToolset | None:
    if not _SKILLS_DIR.is_dir():
        logger.warning("Skills directory not found: %s", _SKILLS_DIR)
        return None

    skills = []
    for skill_dir in sorted(_SKILLS_DIR.iterdir()):
        if not (skill_dir.is_dir() and (skill_dir / "SKILL.md").exists()):
            continue
        try:
            skills.append(load_skill_from_dir(skill_dir))
        except Exception as e:
            logger.warning("Failed to load skill %s: %s", skill_dir.name, e)

    if not skills:
        logger.warning("No skills loaded from %s", _SKILLS_DIR)
        return None

    logger.info("Loaded %d ADK skill(s)", len(skills))
    return SkillToolset(skills=skills)


def _build_tools():
    tools = []
    skill_toolset = _build_skill_toolset()
    if skill_toolset:
        tools.append(skill_toolset)
    return tools


root_agent = Agent(
    model=FAST_MODEL,
    name="adk_agent_builder",
    description="Your guide to building agents with Google's Agent Development Kit. Get architecture advice, code examples, and best practices for single-agent and multi-agent systems — grounded in a curated library of ADK skills.",
    instruction=prompt_v1,
    tools=_build_tools(),
    before_agent_callback=before_agent_callback_update_tools,
)
