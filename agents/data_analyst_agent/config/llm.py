"""
LLM configuration for the Data Analyst agent.

NOTE — why this agent does NOT use the shared FAST_MODEL pattern:

Other agents in this directory route through OpenRouter via LiteLlm
(see e.g. repo_atlas_agent/config/llm.py). The Data Analyst can't:
its core capability is `BuiltInCodeExecutor`, which is a native Gemini
API feature (server-side sandboxed Python). LiteLlm/OpenRouter is a
chat-completions proxy and does not expose Gemini's code execution
endpoint, so a LiteLlm-wrapped model would silently lose the executor.

The model must therefore be native Gemini: make_gemini (agents/model_factory.py)
returns the model name for ADK's Gemini client, or, behind the LiteLLM proxy,
a Gemini client aimed at its pass-through, which keeps the executor. Override
via the GEMINI_MODEL env var if you need to bump versions; the default is the
latest GA Flash.
"""

import os

from model_factory import make_gemini

MODEL = make_gemini("data_analyst_agent", os.getenv("GEMINI_MODEL", "gemini-3.8-flash"))
