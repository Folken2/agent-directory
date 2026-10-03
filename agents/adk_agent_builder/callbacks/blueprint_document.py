"""after_model_callback: move a ```blueprintjson block into session state."""

from __future__ import annotations

import logging
from typing import Any, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse
from google.genai import types

from ..blueprint import BLUEPRINT_STATE_KEY, extract_blueprint

logger = logging.getLogger(__name__)


def _is_prose_text_part(part: Any) -> bool:
    """User-visible prose only: not thoughts, function calls or responses."""
    text = getattr(part, "text", None)
    if not isinstance(text, str) or not text.strip():
        return False
    if getattr(part, "thought", False):
        return False
    return not (getattr(part, "function_call", None) or getattr(part, "function_response", None))


async def capture_blueprint(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """Store a valid blueprint in state and strip the fence from the reply.

    The web UI reads the blueprint from the state_delta and renders it as a
    panel; the fenced JSON is also the client's fallback when no state_delta
    arrives. Safe no-op for every other response.
    """
    try:
        if not llm_response or not llm_response.content or not llm_response.content.parts:
            return None
        parts = llm_response.content.parts
        if any(getattr(p, "function_call", None) for p in parts):
            return None
        prose = [p for p in parts if _is_prose_text_part(p)]
        if not prose:
            return None
        combined = "\n".join(p.text for p in prose)
        blueprint, display = extract_blueprint(combined)
        if not blueprint:
            return None

        callback_context.state[BLUEPRINT_STATE_KEY] = blueprint.to_state()
        # Keep thought parts; replace the prose with the fence-free text.
        others = [p for p in parts if not _is_prose_text_part(p)]
        llm_response.content.parts = others + [types.Part(text=display or blueprint.goal)]
        logger.info("Captured blueprint agents=%d tools=%d", len(blueprint.agents), len(blueprint.tools))
    except Exception as e:  # never break the turn over a blueprint
        logger.error("Error in capture_blueprint: %s", e)
    return None
