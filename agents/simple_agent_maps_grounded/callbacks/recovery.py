"""
Recovery callback for handling Google Maps grounding tool failures.
Also includes fix for ADK 1.18.0 combineTextParts NoneType error.
"""

import logging
from typing import Optional, Any
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse
from google.genai.types import Content, Part

logger = logging.getLogger(__name__)


async def after_model_callback_fix_parts(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """
    Fix for ADK 1.18.0 combineTextParts NoneType error.
    
    Ensures llm_response.content.parts is never None, preventing the frontend
    error "A is not iterable" in combineTextParts.
    
    This is a workaround for GitHub issue #3987:
    https://github.com/google/adk-python/issues/3987
    """
    try:
        if llm_response and llm_response.content:
            # Ensure parts is never None
            if llm_response.content.parts is None:
                logger.warning("⚠️  Fixed None parts in llm_response - setting to empty list")
                llm_response.content.parts = []
            # Ensure parts is a list (not None or other type)
            elif not isinstance(llm_response.content.parts, list):
                logger.warning(f"⚠️  Fixed non-list parts ({type(llm_response.content.parts)}) - converting to list")
                llm_response.content.parts = []
    except Exception as e:
        logger.error(f"Error in after_model_callback_fix_parts: {e}")
    
    return None  # Return None to use original response (we modified it in place)


async def after_tool_recovery_callback(
    callback_context: CallbackContext,
    tool_name: str,
    tool_result: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """
    Recovery callback for google_maps_grounding tool failures.
    
    This callback handles tool execution failures gracefully by:
    1. Detecting errors in tool results
    2. Logging failure details for debugging
    3. Providing helpful error messages
    4. Tracking retry attempts
    5. Suggesting alternative approaches when appropriate
    
    Args:
        callback_context: The callback context with access to state
        tool_name: Name of the tool that was executed
        tool_result: Result from the tool execution
        
    Returns:
        Modified tool result dict, or None to use original result
    """
    # Only handle google_maps_grounding tool
    if tool_name != "google_maps_grounding":
        return None
    
    # Check if tool execution failed
    error = tool_result.get("error") or tool_result.get("status") == "error"
    
    if not error:
        # Success case - log and track successful calls
        query = tool_result.get("query") or "N/A"
        logger.info(f"✅ google_maps_grounding succeeded: {query}")
        
        # Track successful calls in state
        success_count = callback_context.state.get("maps_success_count", 0)
        callback_context.state["maps_success_count"] = success_count + 1
        callback_context.state["last_maps_error"] = None
        
        return None  # Use original successful result
    
    # Failure case - implement recovery logic
    error_message = tool_result.get("error") or tool_result.get("message") or "Unknown error"
    query = tool_result.get("query") or "N/A"
    
    logger.warning(f"⚠️  google_maps_grounding failed for query: '{query}'")
    logger.warning(f"   Error: {error_message}")
    
    # Track failure in state
    failure_count = callback_context.state.get("maps_failure_count", 0)
    callback_context.state["maps_failure_count"] = failure_count + 1
    callback_context.state["last_maps_error"] = {
        "query": query,
        "error": error_message,
    }
    
    # Check retry count
    retry_key = f"maps_retry_{query}"
    retry_count = callback_context.state.get(retry_key, 0)
    max_retries = 2  # Allow up to 2 retries
    
    if retry_count < max_retries:
        # Suggest retry with modified query
        callback_context.state[retry_key] = retry_count + 1
        
        # Provide helpful error message with retry suggestion
        enhanced_error = {
            "status": "error",
            "error": error_message,
            "query": query,
            "retry_suggested": True,
            "retry_count": retry_count + 1,
            "max_retries": max_retries,
            "suggestion": (
                f"The Maps search failed. This might be due to:\n"
                f"- Ambiguous or unclear location query\n"
                f"- API rate limiting or temporary service issue\n"
                f"- Invalid location name or format\n\n"
                f"Try refining your query with:\n"
                f"- More specific location details (city, state, country)\n"
                f"- Correct spelling of place names\n"
                f"- Alternative search terms\n\n"
                f"Retry attempt {retry_count + 1} of {max_retries}."
            )
        }
        
        logger.info(f"🔄 Suggesting retry {retry_count + 1}/{max_retries} for query: '{query}'")
        return enhanced_error
    
    # Max retries reached - provide final error with guidance
    logger.error(f"❌ Max retries reached for query: '{query}'")
    
    final_error = {
        "status": "error",
        "error": error_message,
        "query": query,
        "retry_suggested": False,
        "retry_count": retry_count,
        "max_retries": max_retries,
        "suggestion": (
            f"After {max_retries} attempts, the Maps search could not be completed.\n\n"
            f"**Possible reasons:**\n"
            f"- The location may not exist or be incorrectly specified\n"
            f"- Service may be temporarily unavailable\n"
            f"- Query format may need adjustment\n\n"
            f"**Suggestions:**\n"
            f"- Verify the location name and spelling\n"
            f"- Try a more general search (e.g., city name instead of specific address)\n"
            f"- Break down complex queries into simpler parts\n"
            f"- Check if the location exists in a different region\n\n"
            f"I'll do my best to help with the information available, but may not have "
            f"the most up-to-date location data."
        )
    }
    
    return final_error
