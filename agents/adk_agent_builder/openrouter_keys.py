"""Capped OpenRouter keys for preview agents.

A preview runs the generated agent with a real model, on our account. Each
preview gets its own key from OpenRouter's management API, with a spending
limit and an expiry, and the key is deleted when the preview stops. Code in
the sandbox can read the key; the limit and the expiry are what bound it,
including when this server dies before deleting it.

https://openrouter.ai/docs/guides/overview/auth/management-api-keys
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from .workspace import int_env

logger = logging.getLogger(__name__)

KEYS_URL = "https://openrouter.ai/api/v1/keys"
KEY_HOURS = int_env("BUILDER_PREVIEW_KEY_HOURS", 2)


def _limit_usd() -> float:
    try:
        return float(os.getenv("BUILDER_PREVIEW_KEY_LIMIT_USD", "0.50"))
    except ValueError:
        return 0.50


LIMIT_USD = _limit_usd()


class PreviewKeyError(Exception):
    """OpenRouter refused or could not be reached; the message is safe to show."""


@dataclass(frozen=True)
class CappedKey:
    key: str
    hash: str


def enabled() -> bool:
    return bool(os.getenv("OPENROUTER_MANAGEMENT_KEY"))


def _client() -> httpx.AsyncClient:
    """HTTP client for the management API. Tests replace this."""
    return httpx.AsyncClient(timeout=15.0)


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {os.getenv('OPENROUTER_MANAGEMENT_KEY', '')}"}


async def create_key(name: str) -> CappedKey:
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=KEY_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        async with _client() as client:
            response = await client.post(
                KEYS_URL,
                headers=_headers(),
                json={"name": name, "limit": LIMIT_USD, "expires_at": expires_at},
            )
        response.raise_for_status()
        body = response.json()
        return CappedKey(key=body["key"], hash=body["data"]["hash"])
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.error("Creating a preview key failed: %s", exc)
        raise PreviewKeyError("Could not create a model key for the preview. Try again shortly.") from exc


async def delete_key(key_hash: str) -> None:
    """Best effort: an undeleted key still expires and stays within its limit."""
    try:
        async with _client() as client:
            response = await client.delete(f"{KEYS_URL}/{key_hash}", headers=_headers())
        if response.status_code not in (200, 204, 404):
            logger.warning("Deleting preview key failed: HTTP %s", response.status_code)
    except httpx.HTTPError as exc:
        logger.warning("Deleting preview key failed: %s", exc)
