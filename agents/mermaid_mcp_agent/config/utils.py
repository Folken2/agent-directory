"""
Utility functions for the agent configuration.
"""

import logging
from typing import Any, TYPE_CHECKING
from datetime import datetime

from google.adk.agents import Agent  # or LlmAgent, etc.

if TYPE_CHECKING:
    from google.adk.agents.callback_context import CallbackContext

# Configure logging to output to terminal
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)


def get_current_date() -> str:
    """
    Get the current date in a human-readable format suitable for prompts.
    
    Returns:
        str: Current date formatted as "Month Day, Year" (e.g., "January 15, 2025")
    """
    return datetime.now().strftime("%B %d, %Y")


def _extract_tool_info(tool: Any, tool_idx: int = 0) -> tuple[str, dict[str, Any]]:
    """
    Extract information from a single tool.
    
    Args:
        tool: The tool object to extract info from.
        tool_idx: Index for logging purposes.
        
    Returns:
        Tuple of (markdown_line, metadata_dict)
    """
    # Name
    name = getattr(tool, "name", None)
    if not name:
        name = tool.__class__.__name__
    
    # Description
    description = getattr(tool, "description", "") or ""
    
    # Try to enrich using schema if available
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
                # Best-effort only; ignore schema errors
                pass
    
    param_names = []
    if schema:
        # Prefer schema description if present
        schema_desc = schema.get("description") or description
        params = schema.get("parameters") or schema.get("properties") or {}

        if isinstance(params, dict):
            # OpenAPI-style: {"properties": {...}}
            if "properties" in params and isinstance(params["properties"], dict):
                param_names = list(params["properties"].keys())
            else:
                param_names = list(params.keys())
    else:
        schema_desc = description
    
    param_str = ""
    if param_names:
        param_str = f" Arguments: {', '.join(param_names)}."
    
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
    """
    Async version that can await async get_tools() calls.
    
    Args:
        agent: The Agent instance to extract tools from.

    Returns:
        str: Markdown-formatted string listing all tools with descriptions.
    """
    lines: list[str] = []
    tools = getattr(agent, "tools", []) or []
    
    logger.info(f"🔍 Runtime: Discovering tools for agent '{getattr(agent, 'name', 'unknown')}'")
    logger.info(f"📦 Found {len(tools)} tool(s) attached to agent")
    
    for idx, tool in enumerate(tools, 1):
        logger.info(f"\n{'='*60}")
        logger.info(f"Tool #{idx}:")
        logger.info(f"  Class: {tool.__class__.__name__}")
        
        # Check if this is an MCPToolset
        is_mcp_toolset = tool.__class__.__name__ == "MCPToolset"
        
        if is_mcp_toolset:
            logger.info(f"  🔌 Detected MCPToolset - extracting internal tools at runtime...")
            
            # Try to get connection URL
            try:
                conn_params = getattr(tool, "connection_params", None)
                if conn_params:
                    url = getattr(conn_params, "url", None)
                    if url:
                        logger.info(f"  🔗 MCP Server URL: {url}")
            except Exception:
                pass
            
            # Get internal tools from MCPToolset (async)
            try:
                get_tools_method = getattr(tool, "get_tools", None)
                if get_tools_method:
                    logger.info(f"  🔄 Calling async get_tools()...")
                    internal_tools = await get_tools_method()
                    logger.info(f"  ✅ Successfully retrieved {len(internal_tools)} internal tool(s) from MCPToolset")
                    
                    if not internal_tools:
                        logger.warning(f"  ⚠️  MCPToolset.get_tools() returned empty list")
                        continue
                    
                    # Process each internal tool
                    for internal_idx, internal_tool in enumerate(internal_tools, 1):
                        logger.info(f"\n  ┌─ Internal Tool #{internal_idx}:")
                        line, metadata = _extract_tool_info(internal_tool, internal_idx)
                        
                        logger.info(f"  │  Name: {metadata['name']}")
                        logger.info(f"  │  Description: {metadata['description'] or '(none)'}")
                        if metadata['schema_found']:
                            logger.info(f"  │  ✅ Schema found via: {metadata['schema_source']}")
                            if metadata['parameters']:
                                logger.info(f"  │  Parameters: {', '.join(metadata['parameters'])}")
                        else:
                            logger.info(f"  │  ℹ️  No schema found")
                        logger.info(f"  │  📝 Line: {line[:70]}{'...' if len(line) > 70 else ''}")
                        logger.info(f"  └─")
                        
                        lines.append(line)
                else:
                    logger.warning(f"  ⚠️  MCPToolset has no get_tools() method")
                        
            except Exception as e:
                logger.error(f"  ❌ Error accessing MCPToolset.get_tools(): {e}")
                import traceback
                logger.debug(f"  Traceback: {traceback.format_exc()}")
        else:
            # Regular tool processing
            line, metadata = _extract_tool_info(tool, idx)
            logger.info(f"  Name: {metadata['name']}")
            logger.info(f"  Description: {metadata['description'] or '(none)'}")
            logger.info(f"  📝 Generated line: {line[:80]}{'...' if len(line) > 80 else ''}")
            lines.append(line)
    
    logger.info(f"\n{'='*60}")
    logger.info(f"✅ Generated {len(lines)} tool description(s) at runtime")
    
    return "\n".join(lines)


async def before_agent_callback_update_tools(callback_context: "CallbackContext") -> None:
    """
    Callback to dynamically update agent instruction with MCP tool descriptions at runtime.

    This runs before the agent starts processing, when MCP tools should be loaded and available.
    Extracts tool information and updates the agent's instruction dynamically.

    Also initializes state variables required by the prompt template.

    Args:
        callback_context: The CallbackContext from ADK.
    """
    try:
        # Initialize state variables for error recovery if they don't exist
        # ADK requires all template variables to exist in state
        if "mermaid_retry_count" not in callback_context.state:
            callback_context.state["mermaid_retry_count"] = 0
            logger.info("  🔧 Initialized mermaid_retry_count = 0")

        if "mermaid_last_error" not in callback_context.state:
            callback_context.state["mermaid_last_error"] = ""
            logger.info("  🔧 Initialized mermaid_last_error = ''")

        agent = callback_context._invocation_context.agent
        logger.info(f"\n{'#'*60}")
        logger.info(f"🔄 Runtime callback: Updating instruction with MCP tools")
        logger.info(f"{'#'*60}\n")
        
        # Get current instruction
        current_instruction = getattr(agent, "instruction", "") or ""
        
        # Check if tools section exists and if it's just a placeholder
        tools_section_marker = "You have access to the following tools"
        placeholder_marker = "**MCPToolset**: No description available"
        
        has_tools_section = tools_section_marker in current_instruction
        has_placeholder = placeholder_marker in current_instruction
        
        # Extract base instruction (remove tools section if it exists)
        if has_tools_section:
            # Split on the tools section marker and take everything before it
            parts = current_instruction.split(tools_section_marker)
            base_instruction = parts[0].rstrip()
            
            if has_placeholder:
                logger.info("  🔍 Found placeholder tools section - will replace with real tools")
            else:
                logger.info("  ℹ️  Tools section already has real tools, checking if update needed...")
        else:
            base_instruction = current_instruction
            logger.info("  ℹ️  No tools section found, will add one")
        
        # Extract tools at runtime (MCP should be initialized now)
        tools_md = await render_tools_context_async(agent)
        
        if tools_md:
            # Check if we got real tools (not just placeholder)
            has_real_tools = placeholder_marker not in tools_md and len(tools_md.strip()) > 0
            
            if has_real_tools:
                tools_section = (
                    "\n\nYou have access to the following tools. "
                    "Use them when they are helpful for the user:\n"
                    f"{tools_md}"
                )
                
                # Update agent instruction (replace if placeholder existed, append if not)
                agent.instruction = base_instruction + tools_section
                
                tool_count = len([line for line in tools_md.split('\n') if line.strip().startswith('- **')])
                logger.info(f"  ✅ Updated instruction with {tool_count} real tool description(s)")
                logger.info(f"  📋 Final instruction length: {len(agent.instruction)} characters")
                
                # Show the final tool description
                logger.info(f"\n{'─'*60}")
                logger.info(f"📋 RUNTIME TOOL DESCRIPTION ADDED:")
                logger.info(f"{'─'*60}")
                logger.info(tools_section)
                logger.info(f"{'─'*60}\n")
            else:
                logger.warning("  ⚠️  Only placeholder tools found at runtime, keeping existing instruction")
        else:
            logger.warning("  ⚠️  No tools found in callback")
            
    except Exception as e:
        logger.error(f"  ❌ Error in before_agent_callback: {e}")
        import traceback
        logger.debug(f"  Traceback: {traceback.format_exc()}")
