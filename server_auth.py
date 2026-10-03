"""Shared-secret gate so only the Next.js frontend can call the ADK server."""

import hmac
import logging

logger = logging.getLogger(__name__)


def resolve_internal_token(env) -> str | None:
    """Return the configured internal token, enforcing it unless explicitly opted out.

    Raises RuntimeError when ADK_INTERNAL_TOKEN is unset/empty and
    ADK_ALLOW_UNAUTHENTICATED is not set to "1" (local-development opt-in only).
    """
    token = env.get("ADK_INTERNAL_TOKEN") or None
    if token:
        return token
    if env.get("ADK_ALLOW_UNAUTHENTICATED") == "1":
        return None
    raise RuntimeError(
        "ADK_INTERNAL_TOKEN is required (set ADK_ALLOW_UNAUTHENTICATED=1 only for local development)"
    )


class InternalTokenMiddleware:
    def __init__(self, app, token: str | None):
        self.app = app
        self.token_bytes = token.encode() if token else None
        if not self.token_bytes:
            logger.warning("ADK_INTERNAL_TOKEN not set: ADK server accepts unauthenticated requests")

    async def __call__(self, scope, receive, send):
        if self.token_bytes and scope["type"] in ("http", "websocket"):
            headers = dict(scope.get("headers") or [])
            supplied = headers.get(b"x-internal-token", b"")
            if not hmac.compare_digest(supplied, self.token_bytes):
                if scope["type"] == "websocket":
                    await send({"type": "websocket.close", "code": 1008})
                    return
                await send(
                    {
                        "type": "http.response.start",
                        "status": 401,
                        "headers": [(b"content-type", b"application/json")],
                    }
                )
                await send({"type": "http.response.body", "body": b'{"detail":"unauthorized"}'})
                return
        await self.app(scope, receive, send)
