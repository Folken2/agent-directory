"""LLM configuration for the Xquik MCP agent. Models and routing live in agents/model_factory.py."""

from model_factory import make_model

FAST_MODEL = make_model("xquik_mcp_agent", "fast")
