"""
Utility functions for the deep research agent.

Re-uses the same `before_agent_callback_update_tools` pattern as other agents
in this repo so the Researcher sub-agent's MCP tool descriptions get injected
into its instruction at runtime.
"""

import logging
from datetime import datetime
from typing import Any, TYPE_CHECKING

from google.adk.agents import Agent

if TYPE_CHECKING:
    from google.adk.agents.callback_context import CallbackContext

logging.basicConfig(level=logging.INFO, format="%(message)s", handlers=[logging.StreamHandler()])
logger = logging.getLogger(__name__)


def get_current_date() -> str:
    """Return today's date as 'Month Day, Year' for prompt injection."""
    return datetime.now().strftime("%B %d, %Y")


def _extract_tool_info(tool: Any, tool_idx: int = 0) -> tuple[str, dict[str, Any]]:
    name = getattr(tool, "name", None) or tool.__class__.__name__
    description = getattr(tool, "description", "") or ""

    schema: dict[str, Any] | None = None
    schema_source = None
    for attr in ("to_openapi_schema", "to_json_schema", "schema"):
        if hasattr(tool, attr):
            try:
                candidate = getattr(tool, attr)
                candidate = candidate() if callable(candidate) else candidate
                if isinstance(candidate, dict):
                    schema = candidate
                    schema_source = attr
                    break
            except Exception:
                pass

    param_names: list[str] = []
    if schema:
        schema_desc = schema.get("description") or description
        params = schema.get("parameters") or schema.get("properties") or {}
        if isinstance(params, dict):
            if "properties" in params and isinstance(params["properties"], dict):
                param_names = list(params["properties"].keys())
            else:
                param_names = list(params.keys())
    else:
        schema_desc = description

    param_str = f" Arguments: {', '.join(param_names)}." if param_names else ""
    if not schema_desc:
        schema_desc = "No description available."
    line = f"- **{name}**: {schema_desc}{param_str}"

    metadata = {
        "name": name,
        "class": tool.__class__.__name__,
        "module": tool.__class__.__module__,
        "description": description,
        "schema_found": schema is not None,
        "schema_source": schema_source,
        "parameters": param_names,
    }
    return line, metadata


async def render_tools_context_async(agent: Agent) -> str:
    lines: list[str] = []
    tools = getattr(agent, "tools", []) or []
    for idx, tool in enumerate(tools, 1):
        is_mcp_toolset = tool.__class__.__name__ in ("McpToolset", "MCPToolset")
        if is_mcp_toolset:
            try:
                get_tools_method = getattr(tool, "get_tools", None)
                if not get_tools_method:
                    continue
                internal_tools = await get_tools_method()
                for internal_idx, internal_tool in enumerate(internal_tools, 1):
                    line, _meta = _extract_tool_info(internal_tool, internal_idx)
                    lines.append(line)
            except Exception as e:
                logger.error(f"  ❌ Error accessing MCPToolset.get_tools(): {e}")
        else:
            line, _meta = _extract_tool_info(tool, idx)
            lines.append(line)
    return "\n".join(lines)


async def before_agent_callback_update_tools(callback_context: "CallbackContext") -> None:
    """Inject MCP tool descriptions into the agent's instruction at runtime."""
    try:
        agent = callback_context._invocation_context.agent
        current_instruction = getattr(agent, "instruction", "") or ""
        if not isinstance(current_instruction, str):
            # InstructionProvider — let the user handle dynamic context themselves.
            return

        tools_section_marker = "You have access to the following tools"
        placeholder_marker = "**MCPToolset**: No description available"
        has_tools_section = tools_section_marker in current_instruction
        has_placeholder = placeholder_marker in current_instruction

        if has_tools_section:
            base_instruction = current_instruction.split(tools_section_marker)[0].rstrip()
        else:
            base_instruction = current_instruction

        tools_md = await render_tools_context_async(agent)
        if not tools_md:
            return

        has_real_tools = placeholder_marker not in tools_md and len(tools_md.strip()) > 0
        if not has_real_tools:
            return

        tools_section = (
            "\n\nYou have access to the following tools. "
            "Use them when they are helpful for the research task:\n"
            f"{tools_md}"
        )
        agent.instruction = base_instruction + tools_section
    except Exception as e:
        logger.error(f"  ❌ Error in before_agent_callback: {e}")
