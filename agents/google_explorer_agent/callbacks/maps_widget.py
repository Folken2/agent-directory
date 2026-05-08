"""
Capture Google Maps grounding metadata into session state.

When the maps_specialist's model call grounds on Google Maps, the response
carries a `grounding_metadata.google_maps_widget_context_token` plus a list
of `grounding_chunks`. The frontend needs both to render an embedded,
attribution-compliant Maps widget alongside the chat transcript.

State keys written:
- `maps:captures`            — list[{token, places, captured_at}], appended per call
- `maps:last_widget_token`   — str, convenience pointer to the latest token
- `maps:last_places`         — list[{place_id, title, uri}], latest only
- `maps:last_captured_at`    — ISO-8601 timestamp (UTC), latest only

The list grows across multiple maps_specialist invocations within a turn,
since each `google_maps_grounding` call emits its own token bound to that
call's place chunks. The frontend can either render every capture inline
or fall back to `maps:last_*` for a single-map UX.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse

logger = logging.getLogger(__name__)


async def capture_maps_widget_token(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    try:
        gm = getattr(llm_response, "grounding_metadata", None)
        if gm is None:
            return None

        token = getattr(gm, "google_maps_widget_context_token", None)
        chunks = getattr(gm, "grounding_chunks", None) or []

        places: list[dict] = []
        for chunk in chunks:
            maps_chunk = getattr(chunk, "maps", None)
            if maps_chunk is None:
                continue
            places.append(
                {
                    "place_id": getattr(maps_chunk, "place_id", None),
                    "title": getattr(maps_chunk, "title", None),
                    "uri": getattr(maps_chunk, "uri", None),
                }
            )

        if not token and not places:
            return None

        captured_at = datetime.now(timezone.utc).isoformat()
        capture = {
            "token": token,
            "places": places,
            "captured_at": captured_at,
        }

        # ADK state mutations must reassign — in-place .append() is not tracked
        # in the event's state_delta, so the frontend would never see it.
        existing = callback_context.state.get("maps:captures") or []
        callback_context.state["maps:captures"] = [*existing, capture]

        callback_context.state["maps:last_widget_token"] = token
        callback_context.state["maps:last_places"] = places
        callback_context.state["maps:last_captured_at"] = captured_at

        logger.info(
            f"📍 Captured Maps widget token #{len(existing) + 1} "
            f"(places={len(places)}, token={'yes' if token else 'no'})"
        )
    except Exception as e:
        logger.error(f"Error in capture_maps_widget_token: {e}")

    return None
