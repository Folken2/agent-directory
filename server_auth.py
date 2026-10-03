"""Shared-secret gate so only the Next.js frontend can call the ADK server."""

import hmac
import logging

logger = logging.getLogger(__name__)


class InternalTokenMiddleware:
    def __init__(self, app, token: str | None):
        self.app = app
        self.token = token or None
        if not self.token:
            logger.warning("ADK_INTERNAL_TOKEN not set: ADK server accepts unauthenticated requests")

    async def __call__(self, scope, receive, send):
        if self.token and scope["type"] in ("http", "websocket"):
            headers = dict(scope.get("headers") or [])
            supplied = headers.get(b"x-internal-token", b"").decode("latin-1")
            if not hmac.compare_digest(supplied, self.token):
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
