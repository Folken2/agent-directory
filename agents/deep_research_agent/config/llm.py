"""LLM configuration for the agent. Models and routing live in agents/model_factory.py."""

from model_factory import make_model

FAST_MODEL = make_model("deep_research_agent", "fast")
REASONING_MODEL = make_model("deep_research_agent", "reasoning")
