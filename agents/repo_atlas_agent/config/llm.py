"""LLM configuration for the agent. Models and routing live in agents/model_factory.py."""

from model_factory import make_model

FAST_MODEL = make_model("repo_atlas_agent", "fast")
REASONING_MODEL = make_model("repo_atlas_agent", "reasoning")
