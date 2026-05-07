"""
Validation callback for Mermaid diagram generation.

This callback intercepts tool results to detect Mermaid syntax errors and provides
feedback to the LLM for automatic retry with corrected syntax.
"""

from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

# Maximum number of retry attempts for fixing Mermaid syntax errors
MAX_RETRIES = 3


def after_tool_validation_callback(
    tool,
    args: dict[str, Any],
    tool_response: Any,
    tool_context
) -> Optional[dict[str, Any]]:
    """
    Validates Mermaid tool results and triggers retry if syntax errors detected.

    This callback runs after each tool call and checks if:
    1. The tool is a Mermaid-related tool (render, validate, create)
    2. The result contains an error indicating invalid syntax
    3. We haven't exceeded the maximum retry attempts

    If an error is detected and retries remain, the error is stored in state
    so the LLM can see it and generate corrected code on the next attempt.

    CRITICAL: Parameter names must match ADK's expectations exactly:
    - tool: The tool that was executed
    - args: Arguments passed to the tool
    - tool_response: The response returned by the tool (NOT 'result')
    - tool_context: Context object with access to state

    Args:
        tool: The tool that was executed
        args: Arguments passed to the tool
        tool_response: The response returned by the tool
        tool_context: Context object with access to state

    Returns:
        None to allow normal flow, or a dict with error if max retries exceeded
    """
    # Get tool name and check if it's a Mermaid tool
    tool_name = getattr(tool, "name", "").lower()
    is_mermaid_tool = any(
        keyword in tool_name
        for keyword in ["mermaid", "render", "validate", "diagram", "create"]
    )

    if not is_mermaid_tool:
        # Not a Mermaid tool, pass through
        return None

    logger.info(f"[MERMAID VALIDATION] Checking result from tool: {tool_name}")

    # Check for errors in tool_response
    error = None
    if isinstance(tool_response, dict):
        # Check common error fields
        error = tool_response.get("error") or tool_response.get("errors") or tool_response.get("message")

        # Some tools return success=False with error details
        if not error and tool_response.get("success") is False:
            error = tool_response.get("details", "Unknown error")
    elif isinstance(tool_response, str):
        # Some tools might return error as plain string
        if "error" in tool_response.lower() or "invalid" in tool_response.lower():
            error = tool_response

    if error:
        # Error detected - check retry count
        retry_count = tool_context.state.get("mermaid_retry_count", 0)

        if retry_count < MAX_RETRIES:
            # Still have retries left - store error for LLM to see
            tool_context.state["mermaid_retry_count"] = retry_count + 1
            tool_context.state["mermaid_last_error"] = str(error)

            logger.warning(
                f"[MERMAID VALIDATION] ❌ Syntax error detected "
                f"(attempt {retry_count + 1}/{MAX_RETRIES}):\n{error}"
            )
            logger.info(
                f"[MERMAID VALIDATION] 🔄 Error stored in state for LLM to fix and retry"
            )

            # Return None to allow the error to propagate to the LLM
            # The LLM will see the error in the tool result and can generate corrected code
            return None
        else:
            # Max retries exceeded - give up
            logger.error(
                f"[MERMAID VALIDATION] 🛑 Max retries ({MAX_RETRIES}) reached. Giving up."
            )
            return {
                "error": (
                    f"Failed to generate valid Mermaid diagram after {MAX_RETRIES} attempts. "
                    f"Last error: {error}"
                ),
                "give_up": True,
                "attempts": retry_count + 1
            }
    else:
        # Success - reset retry counter
        previous_retry_count = tool_context.state.get("mermaid_retry_count", 0)

        if previous_retry_count > 0:
            logger.info(
                f"[MERMAID VALIDATION] ✅ Valid Mermaid code generated after "
                f"{previous_retry_count} retry attempt(s)"
            )
        else:
            logger.info("[MERMAID VALIDATION] ✅ Valid Mermaid code generated on first try")

        # Clear retry state (set to defaults, don't remove keys)
        tool_context.state["mermaid_retry_count"] = 0
        tool_context.state["mermaid_last_error"] = ""  # Clear error but keep key

    return None
