import asyncio

import pytest
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.testclient import TestClient

from server_auth import InternalTokenMiddleware, resolve_internal_token


def make_client(token):
    app = FastAPI()

    @app.get("/list-apps")
    def list_apps():
        return ["a"]

    @app.websocket("/ws")
    async def ws_endpoint(websocket: WebSocket):
        await websocket.accept()
        await websocket.send_text("hello")
        await websocket.close()

    app.add_middleware(InternalTokenMiddleware, token=token)
    return TestClient(app)


def test_rejects_missing_token():
    assert make_client("s3cret").get("/list-apps").status_code == 401


def test_rejects_wrong_token():
    r = make_client("s3cret").get("/list-apps", headers={"X-Internal-Token": "nope"})
    assert r.status_code == 401


def test_accepts_matching_token():
    r = make_client("s3cret").get("/list-apps", headers={"X-Internal-Token": "s3cret"})
    assert r.status_code == 200
    assert r.json() == ["a"]


def test_open_when_no_token_configured():
    assert make_client(None).get("/list-apps").status_code == 200


def test_non_ascii_header_value_rejected_without_crashing():
    """A non-ASCII X-Internal-Token must 401, not raise TypeError from str/bytes comparison."""
    sent = []

    async def dummy_app(scope, receive, send):
        sent.append("called")

    middleware = InternalTokenMiddleware(dummy_app, token="s3cret")

    async def receive():
        return {"type": "http.request"}

    responses = []

    async def send(message):
        responses.append(message)

    scope = {"type": "http", "headers": [(b"x-internal-token", b"\xe9")]}
    asyncio.run(middleware(scope, receive, send))

    assert responses[0]["type"] == "http.response.start"
    assert responses[0]["status"] == 401
    assert sent == []


def test_rejects_websocket_without_token():
    client = make_client("s3cret")
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws"):
            pass
    assert exc_info.value.code == 1008


def test_accepts_websocket_with_matching_token():
    client = make_client("s3cret")
    with client.websocket_connect("/ws", headers={"X-Internal-Token": "s3cret"}) as websocket:
        assert websocket.receive_text() == "hello"


def test_resolve_internal_token_returns_configured_token():
    assert resolve_internal_token({"ADK_INTERNAL_TOKEN": "abc"}) == "abc"


def test_resolve_internal_token_raises_without_opt_in():
    with pytest.raises(RuntimeError):
        resolve_internal_token({})


def test_resolve_internal_token_allows_explicit_opt_in():
    assert resolve_internal_token({"ADK_ALLOW_UNAUTHENTICATED": "1"}) is None


def test_resolve_internal_token_ignores_opt_in_when_token_set():
    assert resolve_internal_token({"ADK_INTERNAL_TOKEN": "abc", "ADK_ALLOW_UNAUTHENTICATED": "1"}) == "abc"
