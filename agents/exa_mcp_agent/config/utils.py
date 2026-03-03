"""
Utility functions for the agent configuration.
"""

import logging
import inspect
import asyncio
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


def render_tools_context(agent: Agent) -> str:
    """
    Build a markdown bullet list describing all tools attached to this agent.

    Safe to call on mixed tool types (FunctionTool, AgentTool, MCP, etc.).

    Args:
        agent: The Agent instance to extract tools from.

    Returns:
        str: Markdown-formatted string listing all tools with descriptions.
    """
    lines: list[str] = []
    tools = getattr(agent, "tools", []) or []
    
    logger.info(f"🔍 Discovering tools for agent '{getattr(agent, 'name', 'unknown')}'")
    logger.info(f"📦 Found {len(tools)} tool(s) attached to agent")
    
    for idx, tool in enumerate(tools, 1):
        logger.info(f"\n{'='*60}")
        logger.info(f"Tool #{idx}:")
        logger.info(f"  Class: {tool.__class__.__name__}")
        logger.info(f"  Module: {tool.__class__.__module__}")
        
        # Check if this is an MCPToolset
        is_mcp_toolset = tool.__class__.__name__ in ("McpToolset", "MCPToolset")
        
        if is_mcp_toolset:
            logger.info(f"  🔌 Detected MCPToolset - extracting internal tools...")
            
            # Try to get MCP server info/description
            server_metadata = {}
            for attr in ("server_info", "server_description", "description", "connection_params"):
                try:
                    value = getattr(tool, attr, None)
                    if value:
                        server_metadata[attr] = value
                        logger.info(f"  📡 MCP {attr}: {str(value)[:100]}{'...' if len(str(value)) > 100 else ''}")
                except Exception:
                    pass
            
            # Try to get connection URL if available
            try:
                conn_params = getattr(tool, "connection_params", None)
                if conn_params:
                    url = getattr(conn_params, "url", None)
                    if url:
                        logger.info(f"  🔗 MCP Server URL: {url}")
            except Exception:
                pass
            
            # Get internal tools from MCPToolset
            # Handle both sync and async get_tools() methods
            try:
                get_tools_method = getattr(tool, "get_tools", None)
                if get_tools_method:
                    # Check if it's a coroutine
                    if inspect.iscoroutinefunction(get_tools_method):
                        logger.info(f"  🔄 get_tools() is async - calling with asyncio...")
                        try:
                            # Try to get existing event loop, or create new one
                            try:
                                loop = asyncio.get_running_loop()
                                logger.warning(f"  ⚠️  Event loop already running - cannot use asyncio.run()")
                                logger.info(f"  💡 MCP tools will be available at runtime")
                                # Fall back to placeholder
                                line, metadata = _extract_tool_info(tool, idx)
                                logger.info(f"  📝 Generated line: {line[:80]}{'...' if len(line) > 80 else ''}")
                                lines.append(line)
                                continue
                            except RuntimeError:
                                # No running loop, safe to use asyncio.run()
                                pass
                            
                            # Run async function synchronously
                            internal_tools = asyncio.run(get_tools_method())
                            logger.info(f"  ✅ Successfully retrieved {len(internal_tools)} internal tool(s) from MCPToolset")
                            
                            if not internal_tools:
                                logger.warning(f"  ⚠️  MCPToolset.get_tools() returned empty list")
                                # Fall back to treating it as a regular tool
                                line, metadata = _extract_tool_info(tool, idx)
                                logger.info(f"  📝 Generated line: {line[:80]}{'...' if len(line) > 80 else ''}")
                                lines.append(line)
                            else:
                                # Process each internal tool
                                for internal_idx, internal_tool in enumerate(internal_tools, 1):
                                    logger.info(f"\n  ┌─ Internal Tool #{internal_idx}:")
                                    line, metadata = _extract_tool_info(internal_tool, internal_idx)
                                    
                                    logger.info(f"  │  Name: {metadata['name']}")
                                    logger.info(f"  │  Class: {metadata['class']}")
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
                        except Exception as async_error:
                            logger.error(f"  ❌ Error calling async get_tools(): {async_error}")
                            logger.info(f"  💡 This might be because the MCP connection isn't initialized yet")
                            logger.info(f"  📝 Falling back to placeholder description")
                            # Fall back to treating it as a regular tool
                            line, metadata = _extract_tool_info(tool, idx)
                            logger.info(f"  📝 Generated line: {line[:80]}{'...' if len(line) > 80 else ''}")
                            lines.append(line)
                    else:
                        # Synchronous call
                        logger.info(f"  🔄 Calling synchronous get_tools()...")
                        internal_tools = get_tools_method()
                        logger.info(f"  ✅ Found {len(internal_tools)} internal tool(s) in MCPToolset")
                        
                        if not internal_tools:
                            logger.warning(f"  ⚠️  MCPToolset.get_tools() returned empty list - tools may not be initialized yet")
                            # Fall back to treating it as a regular tool
                            line, metadata = _extract_tool_info(tool, idx)
                            logger.info(f"  📝 Generated line: {line[:80]}{'...' if len(line) > 80 else ''}")
                            lines.append(line)
                        else:
                            # Process each internal tool
                            for internal_idx, internal_tool in enumerate(internal_tools, 1):
                                logger.info(f"\n  ┌─ Internal Tool #{internal_idx}:")
                                line, metadata = _extract_tool_info(internal_tool, internal_idx)
                                
                                logger.info(f"  │  Name: {metadata['name']}")
                                logger.info(f"  │  Class: {metadata['class']}")
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
                    # Fall back to treating it as a regular tool
                    line, metadata = _extract_tool_info(tool, idx)
                    logger.info(f"  📝 Generated line: {line[:80]}{'...' if len(line) > 80 else ''}")
                    lines.append(line)
                        
            except Exception as e:
                logger.error(f"  ❌ Error accessing MCPToolset.get_tools(): {e}")
                import traceback
                logger.debug(f"  Traceback: {traceback.format_exc()}")
                logger.info(f"  Falling back to basic tool extraction...")
                # Fall back to treating it as a regular tool
                line, metadata = _extract_tool_info(tool, idx)
                logger.info(f"  📝 Generated line: {line[:80]}{'...' if len(line) > 80 else ''}")
                lines.append(line)
        else:
            # Regular tool processing
            line, metadata = _extract_tool_info(tool, idx)
            
            logger.info(f"  Name: {metadata['name']}")
            logger.info(f"  Description: {metadata['description'] or '(none)'}")
            
            # Check for available attributes
            available_attrs = [attr for attr in dir(tool) if not attr.startswith("_")]
            logger.info(f"  Available attributes: {', '.join(available_attrs[:10])}{'...' if len(available_attrs) > 10 else ''}")
            
            if metadata['schema_found']:
                logger.info(f"  ✅ Schema found via: {metadata['schema_source']}")
                if metadata['parameters']:
                    logger.info(f"  Parameters: {', '.join(metadata['parameters'])}")
            else:
                logger.info(f"  ℹ️  No schema found (tried: to_openapi_schema, to_json_schema, schema)")
            
            logger.info(f"  📝 Generated line: {line[:80]}{'...' if len(line) > 80 else ''}")
            lines.append(line)
    
    logger.info(f"\n{'='*60}")
    logger.info(f"✅ Generated {len(lines)} tool description(s)")
    
    return "\n".join(lines)


def make_instruction_with_tools(agent: Agent) -> str:
    """
    Return a new instruction string that appends a tools section
    generated from the agent's current tools.

    Does not mutate the agent; you decide when to assign it.

    Args:
        agent: The Agent instance to extract tools and instruction from.

    Returns:
        str: The instruction string with tools section appended.
    """
    logger.info(f"\n{'#'*60}")
    logger.info(f"🔧 Building instruction with tools for agent: {getattr(agent, 'name', 'unknown')}")
    logger.info(f"{'#'*60}\n")
    
    base_instruction = getattr(agent, "instruction", "") or ""
    logger.info(f"📄 Base instruction length: {len(base_instruction)} characters")

    tools_md = render_tools_context(agent)
    if not tools_md:
        logger.warning("⚠️  No tools found or no tool descriptions generated")
        return base_instruction

    tools_section = (
        "\n\nYou have access to the following tools. "
        "Use them when they are helpful for the user:\n"
        f"{tools_md}"
    )
    
    logger.info(f"📝 Tools section length: {len(tools_section)} characters")
    logger.info(f"📋 Final instruction length: {len(base_instruction + tools_section)} characters")
    
    # Show the final tool description that will be added to the instruction
    logger.info(f"\n{'─'*60}")
    logger.info(f"📋 FINAL TOOL DESCRIPTION TO BE ADDED:")
    logger.info(f"{'─'*60}")
    logger.info(tools_section)
    logger.info(f"{'─'*60}\n")
    
    logger.info(f"{'#'*60}")
    logger.info("✅ Instruction with tools generated successfully")
    logger.info(f"{'#'*60}\n")

    return base_instruction + tools_section


async def before_agent_callback_update_tools(callback_context: "CallbackContext") -> None:
    """
    Callback to dynamically update agent instruction with MCP tool descriptions at runtime.
    
    This runs before the agent starts processing, when MCP tools should be loaded and available.
    Extracts tool information and updates the agent's instruction dynamically.
    
    Args:
        callback_context: The CallbackContext from ADK.
    """
    try:
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


async def render_tools_context_async(agent: Agent) -> str:
    """
    Async version of render_tools_context that can await async get_tools() calls.
    
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
        is_mcp_toolset = tool.__class__.__name__ in ("McpToolset", "MCPToolset")
        
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
