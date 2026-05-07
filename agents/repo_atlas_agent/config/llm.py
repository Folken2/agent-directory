"""LLM configuration for the repo visualizer agent."""

import os

from google.adk.models.lite_llm import LiteLlm

os.environ.setdefault("OR_SITE_URL", "https://agentdirectory.folch.ai")
os.environ.setdefault("OR_APP_NAME", "Google ADK Directory")

FAST_MODEL = LiteLlm(
    model=os.getenv("FAST_MODEL", "openrouter/google/gemini-3-flash-preview"),
    app_name="adk-samples-directory",
)

REASONING_MODEL = LiteLlm(
    model=os.getenv("REASONING_MODEL", "openrouter/google/gemini-3-pro-preview"),
    app_name="adk-samples-directory",
)
