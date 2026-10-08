"""Preview proxy: the web app's only way to an agent running in a builder sandbox.

Mounted on the ADK server by run_adk.py, so the internal-token middleware
guards it. The web app calls it with the ADK user id it resolved for the
builder session (app/api/preview/route.ts checks the browser owns that
session). This module holds what reaches the sandbox: its private URL, the
E2B traffic token and the preview server's API key. None of them leave the
backend.

Must be imported as `adk_agent_builder.preview_api`, the module name ADK's
agent loader uses, so it shares the builder's sandbox registry.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from . import openrouter_keys, sandbox, workspace

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/builder/preview", tags=["builder-preview"])

PREVIEW_USER = "preview"
MAX_TEXT_CHARS = 4000
_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class RunRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    preview_session_id: str = Field(alias="previewSessionId", pattern=_ID_RE.pattern)
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)


def _client() -> httpx.AsyncClient:
    """HTTP client towards the sandbox. Tests replace this."""
    return httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=300.0))


def _box(user_id: str, session_id: str):
    if not (_ID_RE.match(user_id) and _ID_RE.match(session_id)):
        raise HTTPException(status_code=400, detail="invalid id")
    return sandbox.find(workspace.session_key(user_id, session_id))


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code})


@router.get("/{user_id}/{session_id}")
async def preview_status(user_id: str, session_id: str) -> dict:
    box = _box(user_id, session_id)
    preview = box.preview if box else None
    if preview is None:
        return {"running": False}
    return {
        "running": True,
        "project": preview.project,
        "package": preview.package,
        "startedAt": datetime.fromtimestamp(preview.started_at, timezone.utc).isoformat(),
        "messagesLeft": max(sandbox.PREVIEW_MAX_MESSAGES - preview.messages, 0),
    }


@router.delete("/{user_id}/{session_id}")
async def stop_preview(user_id: str, session_id: str) -> dict:
    box = _box(user_id, session_id)
    if box is None:
        return {"stopped": False}
    async with box.lock:
        return {"stopped": await sandbox.stop_preview(box)}


@router.post("/{user_id}/{session_id}/run_sse")
async def run_preview(user_id: str, session_id: str, body: RunRequest):
    box = _box(user_id, session_id)
    preview = box.preview if box else None
    if preview is None:
        return _error(404, "no_preview")
    if preview.messages >= sandbox.PREVIEW_MAX_MESSAGES:
        return _error(429, "preview_limit")

    # Preview traffic doesn't go through the ADK environment, so keep the
    # sandbox (E2B's TTL) and its registry entry (the idle reaper) alive here.
    if not await box.env.keepalive():
        box.preview = None
        await openrouter_keys.delete_key(preview.key_hash)
        return _error(410, "preview_stopped")
    box.last_used = time.monotonic()
    preview.messages += 1

    base, headers = box.env.endpoint(sandbox.PREVIEW_PORT)
    headers = {**headers, "Authorization": f"Bearer {preview.api_key}"}
    session_url = f"{base}/apps/{preview.package}/users/{PREVIEW_USER}/sessions/{body.preview_session_id}"

    client = _client()
    try:
        # In-memory sessions vanish when the preview restarts: recreate by id.
        found = await client.get(session_url, headers=headers)
        if found.status_code == 404:
            found = await client.post(session_url, headers=headers, json={})
        if found.status_code >= 400:
            logger.warning("Preview session call failed: HTTP %s", found.status_code)
            await client.aclose()
            return _error(502, "preview_unreachable")

        upstream = await client.send(
            client.build_request(
                "POST",
                f"{base}/run_sse",
                headers={**headers, "Accept": "text/event-stream"},
                json={
                    "appName": preview.package,
                    "userId": PREVIEW_USER,
                    "sessionId": body.preview_session_id,
                    "newMessage": {"role": "user", "parts": [{"text": body.text}]},
                    "streaming": True,
                },
            ),
            stream=True,
        )
    except httpx.HTTPError as exc:
        logger.warning("Preview unreachable: %s", exc)
        await client.aclose()
        return _error(502, "preview_unreachable")

    if upstream.status_code != 200:
        detail = (await upstream.aread())[:300]
        logger.warning("Preview run failed: HTTP %s %r", upstream.status_code, detail)
        await upstream.aclose()
        await client.aclose()
        return _error(502, "preview_unreachable")

    async def relay():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        relay(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
