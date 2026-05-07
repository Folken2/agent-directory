"""
Repo Atlas — ingests any public GitHub repository and produces a Mermaid
diagram of its structure plus a concise overview.

Single LlmAgent with three function tools that hit the GitHub REST API
directly (no scraping). Optional GITHUB_TOKEN env var raises the rate limit
from 60/hr unauthenticated to 5000/hr.
"""

from google.adk.agents import LlmAgent

from .config.llm import FAST_MODEL
from .prompt.prompt import prompt_v0
from .tools import fetch_repo_meta, fetch_repo_tree, read_repo_file

root_agent = LlmAgent(
    model=FAST_MODEL,
    name="repo_atlas_agent",
    description=(
        "Ingests any public GitHub repository and produces a Mermaid diagram "
        "of its structure plus a concise overview — purpose, stack, layout, "
        "and entry points — all in a single turn."
    ),
    instruction=prompt_v0,
    tools=[fetch_repo_meta, fetch_repo_tree, read_repo_file],
)
