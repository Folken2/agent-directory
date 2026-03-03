"""
Self-healing error recovery plugin for ADK agents.

Extends Google's ReflectAndRetryToolPlugin with detection of error
responses hidden in successful tool returns (e.g. {"status": "error"}).

When a tool fails, the LLM receives structured reflection guidance:
- Error details and the args it used
- Numbered suggestions (check params, check state, try alternatives)
- Retry count / max retries

After max retries, the LLM is told to stop using that tool and try a
different approach.

Registered at the Runner level so it applies globally to ALL agents and
tools, including MCP agents (Exa, Tavily, Mermaid).
"""

from __future__ import annotations

from typing import Any, Optional

from google.adk.plugins.reflect_retry_tool_plugin import (
    ReflectAndRetryToolPlugin,
    TrackingScope,
)
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext


class SelfHealingToolPlugin(ReflectAndRetryToolPlugin):
    """ReflectAndRetry with MCP/tool error-in-success detection.

    Many MCP tools and custom tools return {"status": "error", ...}
    instead of raising exceptions. This subclass detects those and feeds
    them into the reflect-and-retry loop so the LLM can self-correct.
    """

    def __init__(
        self,
        max_retries: int = 3,
        tracking_scope: TrackingScope = TrackingScope.INVOCATION,
    ) -> None:
        super().__init__(
            name="self_healing_tools",
            max_retries=max_retries,
            throw_exception_if_retry_exceeded=False,
            tracking_scope=tracking_scope,
        )

    async def extract_error_from_result(
        self,
        *,
        tool: BaseTool,
        tool_args: dict[str, Any],
        tool_context: ToolContext,
        result: Any,
    ) -> Optional[dict[str, Any]]:
        """Detect errors hidden in successful tool responses.

        Catches MCP tools and local tools that return error status
        without raising exceptions.
        """
        if not isinstance(result, dict):
            return None

        # Common pattern: {"status": "error", "error": "..."}
        if result.get("status") == "error":
            return result

        # Nested pattern: {"data": {"error": "..."}}
        data = result.get("data")
        if isinstance(data, dict) and data.get("error"):
            return data

        return None


# Singleton instance — imported by __init__.py and referenced by run_adk.py
self_healing_plugin = SelfHealingToolPlugin()
