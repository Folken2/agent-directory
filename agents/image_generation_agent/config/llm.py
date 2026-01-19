"""
LLM configuration for the agent. Define your favourite provider and model here.
"""

import os

from google.adk.models.lite_llm import LiteLlm

FAST_MODEL = LiteLlm(
    model=os.getenv("FAST_MODEL", "openrouter/google/gemini-3-flash-preview"),
    app_name="adk-samples-directory",
)

REASONING_MODEL = LiteLlm(
    model=os.getenv("REASONING_MODEL", "openrouter/google/gemini-3-pro-preview"),
    app_name="adk-samples-directory",
)

IMAGE_MODEL = LiteLlm(
    model=os.getenv("IMAGE_MODEL", "openrouter/google/gemini-2.5-flash-image"),
    app_name="adk-samples-directory",
)
