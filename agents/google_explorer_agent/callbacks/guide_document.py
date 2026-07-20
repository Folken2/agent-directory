"""Parse coordinator GuideDocument JSON into session state."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse
from google.genai import types

logger = logging.getLogger(__name__)

FENCE_RE = re.compile(r"```guidejson\s*([\s\S]*?)```", re.IGNORECASE)
SHAPES = {"neighborhood", "itinerary", "comparison", "single"}


def _validate(doc: Any) -> Optional[dict]:
    if not isinstance(doc, dict):
        return None
    if doc.get("shape") not in SHAPES:
        return None
    if not isinstance(doc.get("lead"), str):
        return None
    places = doc.get("places")
    sections = doc.get("sections")
    if not isinstance(places, list) or not places:
        return None
    if not isinstance(sections, list):
        return None
    ids = set()
    for p in places:
        if not isinstance(p, dict) or not isinstance(p.get("id"), str) or not isinstance(p.get("name"), str):
            return None
        ids.add(p["id"])
    for s in sections:
        if not isinstance(s, dict) or not isinstance(s.get("id"), str) or not isinstance(s.get("title"), str):
            return None
        pids = s.get("placeIds")
        if not isinstance(pids, list) or not all(isinstance(i, str) and i in ids for i in pids):
            return None
    return doc


def _extract_from_text(text: str) -> tuple[Optional[dict], str]:
    m = FENCE_RE.search(text)
    if not m:
        # whole-text JSON attempt
        try:
            raw = json.loads(text.strip())
            doc = _validate(raw)
            if doc:
                return doc, doc.get("lead") or ""
        except json.JSONDecodeError:
            pass
        return None, text
    try:
        raw = json.loads(m.group(1).strip())
    except json.JSONDecodeError:
        return None, text
    doc = _validate(raw)
    display = FENCE_RE.sub("", text).strip()
    return doc, display if doc else text


def _is_prose_text_part(part: Any) -> bool:
    """True for genuine user-visible prose parts only.

    Mirrors the `part.text and not part.thought` idiom used throughout ADK
    (e.g. `llm_agent.py`, `flows/llm_flows/contents.py`) so we never treat
    model "thinking" text, function calls, or function responses as prose
    eligible for fence extraction or display rewriting.
    """
    text = getattr(part, "text", None)
    if not isinstance(text, str) or not text.strip():
        return False
    if getattr(part, "thought", False):
        return False
    if getattr(part, "function_call", None) or getattr(part, "function_response", None):
        return False
    return True


async def capture_guide_document(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """Only meaningful on the coordinator final answer; safe no-op otherwise."""
    try:
        if not llm_response or not llm_response.content or not llm_response.content.parts:
            return None
        all_parts = llm_response.content.parts
        # Skip thought/tool parts entirely — never a source of the fence, and
        # never a target for the display-text rewrite below.
        texts = [part.text for part in all_parts if _is_prose_text_part(part)]
        if not texts:
            return None
        combined = "\n".join(texts)
        doc, display = _extract_from_text(combined)
        if not doc:
            return None

        # Mixed tool turns: if any part still has a pending function_call,
        # full no-op — don't write state and don't rewrite parts.
        has_pending_function_call = any(getattr(p, "function_call", None) for p in all_parts)
        if has_pending_function_call:
            return None

        callback_context.state["guide:document"] = doc

        if display == combined:
            logger.info(
                "📘 Captured guide:document shape=%s places=%s",
                doc.get("shape"),
                len(doc.get("places") or []),
            )
            return None

        clean_text = display or doc.get("lead") or ""
        llm_response.content.parts = [types.Part(text=clean_text)]

        logger.info("📘 Captured guide:document shape=%s places=%s", doc.get("shape"), len(doc.get("places") or []))
    except Exception as e:
        logger.error("Error in capture_guide_document: %s", e)
    return None
