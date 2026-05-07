"""
Recovery callback for handling Google Maps grounding tool failures.
Also includes fix for ADK 1.18.0 combineTextParts NoneType error.
"""

import logging
from typing import Optional, Any
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse

logger = logging.getLogger(__name__)


async def after_model_callback_fix_parts(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """
    Fix for ADK 1.18.0 combineTextParts NoneType error.

    Ensures llm_response.content.parts is never None, preventing the frontend
    error "A is not iterable" in combineTextParts.

    Workaround for https://github.com/google/adk-python/issues/3987
    """
    try:
        if llm_response and llm_response.content:
            if llm_response.content.parts is None:
                logger.warning("⚠️  Fixed None parts in llm_response - setting to empty list")
                llm_response.content.parts = []
            elif not isinstance(llm_response.content.parts, list):
                logger.warning(
                    f"⚠️  Fixed non-list parts ({type(llm_response.content.parts)}) - converting to list"
                )
                llm_response.content.parts = []
    except Exception as e:
        logger.error(f"Error in after_model_callback_fix_parts: {e}")

    return None


async def after_tool_recovery_callback(
    callback_context: CallbackContext,
    tool_name: str,
    tool_result: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """
    Recovery callback for google_maps_grounding tool failures.

    Detects errors, tracks retries in session state, and returns enhanced
    error payloads that nudge the model toward a refined query.
    """
    if tool_name != "google_maps_grounding":
        return None

    error = tool_result.get("error") or tool_result.get("status") == "error"

    if not error:
        query = tool_result.get("query") or "N/A"
        logger.info(f"✅ google_maps_grounding succeeded: {query}")
        success_count = callback_context.state.get("maps_success_count", 0)
        callback_context.state["maps_success_count"] = success_count + 1
        callback_context.state["last_maps_error"] = None
        return None

    error_message = tool_result.get("error") or tool_result.get("message") or "Unknown error"
    query = tool_result.get("query") or "N/A"

    logger.warning(f"⚠️  google_maps_grounding failed for query: '{query}'")
    logger.warning(f"   Error: {error_message}")

    failure_count = callback_context.state.get("maps_failure_count", 0)
    callback_context.state["maps_failure_count"] = failure_count + 1
    callback_context.state["last_maps_error"] = {
        "query": query,
        "error": error_message,
    }

    retry_key = f"maps_retry_{query}"
    retry_count = callback_context.state.get(retry_key, 0)
    max_retries = 2

    if retry_count < max_retries:
        callback_context.state[retry_key] = retry_count + 1
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
            ),
        }
        logger.info(f"🔄 Suggesting retry {retry_count + 1}/{max_retries} for query: '{query}'")
        return enhanced_error

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
        ),
    }
    return final_error
