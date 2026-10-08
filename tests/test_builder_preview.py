"""The builder's live preview: capped keys, start/stop, the proxy, and a real boot.

Neither E2B nor OpenRouter is called: OpenRouter and the sandbox's HTTP port
are httpx mock transports, the sandbox is scripted, and one test boots a
generated project's server for real through a local stand-in.
"""

import asyncio
import json
import os
import signal
import socket
import sys
import time

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from google.adk.environment._base_environment import ExecutionResult

from agents.adk_agent_builder import openrouter_keys, preview_api, sandbox, workspace
from agents.adk_agent_builder.prompt.prompt import build_prompt_v3
from agents.adk_agent_builder.tools import get_tools
from agents.adk_agent_builder.tools.sandbox_tools import start_preview, stop_preview
from test_agent_builder import FakeToolContext, _scaffold
from test_builder_sandbox import LocalSandbox, ScriptedEnvironment, _ctx, _use

SIGNED_IN = "u_123"


class FakeOpenRouter:
    """Records management API calls; hands out numbered keys."""

    def __init__(self, fail=False):
        self.fail = fail
        self.created: list[dict] = []
        self.deleted: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer mgmt-key"
        if request.method == "POST":
            if self.fail:
                return httpx.Response(500, json={"error": "nope"})
            body = json.loads(request.content)
            self.created.append(body)
            n = len(self.created)
            return httpx.Response(201, json={"key": f"sk-or-capped-{n}", "data": {"hash": f"hash-{n}"}})
        if request.method == "DELETE":
            self.deleted.append(request.url.path.rsplit("/", 1)[-1])
            return httpx.Response(200, json={"deleted": True})
        return httpx.Response(405)


@pytest.fixture(autouse=True)
def preview_env(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace, "ROOT", tmp_path / "workspaces")
    monkeypatch.setenv("E2B_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MANAGEMENT_KEY", "mgmt-key")
    monkeypatch.delenv("BUILDER_SANDBOX_SIGNED_IN_ONLY", raising=False)
    router = FakeOpenRouter()
    monkeypatch.setattr(
        openrouter_keys, "_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(router.handler))
    )
    sandbox._active.clear()
    yield router
    sandbox._active.clear()


# ── capped keys ───────────────────────────────────────────────────────


def test_keys_are_capped_and_expire(preview_env):
    key = asyncio.run(openrouter_keys.create_key("adk-builder-preview-x"))
    assert key == openrouter_keys.CappedKey(key="sk-or-capped-1", hash="hash-1")
    body = preview_env.created[0]
    assert body["name"] == "adk-builder-preview-x"
    assert body["limit"] == openrouter_keys.LIMIT_USD > 0
    assert body["expires_at"].endswith("Z")
    asyncio.run(openrouter_keys.delete_key("hash-1"))
    assert preview_env.deleted == ["hash-1"]


def test_key_failures_are_reported(monkeypatch):
    failing = FakeOpenRouter(fail=True)
    monkeypatch.setattr(
        openrouter_keys, "_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(failing.handler))
    )
    with pytest.raises(openrouter_keys.PreviewKeyError):
        asyncio.run(openrouter_keys.create_key("x"))


# ── wiring ────────────────────────────────────────────────────────────


def test_preview_tools_need_both_keys(monkeypatch):
    names = {t.name for t in get_tools()}
    assert {"start_preview", "stop_preview"} <= names
    assert "# Live preview" in build_prompt_v3({}, sandbox=True, preview=True)
    monkeypatch.delenv("OPENROUTER_MANAGEMENT_KEY")
    names = {t.name for t in get_tools()}
    assert "run_checks" in names
    assert not {"start_preview", "stop_preview"} & names


# ── the E2B environment ───────────────────────────────────────────────


class FakeAsyncSandbox:
    """Records what PrivateE2BEnvironment asks of e2b's AsyncSandbox."""

    created_with: dict = {}

    def __init__(self):
        self.traffic_access_token = "traffic-token"
        self.timeouts: list[int] = []
        self.runs: list[dict] = []
        self.killed: list[int] = []
        self.running = True
        sandbox = self

        class Handle:
            pid = 77
            disconnected = False

            async def disconnect(self):
                Handle.disconnected = True

        class Commands:
            async def run(self, cmd, **kwargs):
                sandbox.runs.append({"cmd": cmd, **kwargs})
                return Handle()

            async def kill(self, pid):
                sandbox.killed.append(pid)
                return True

        self.handle = Handle
        self.commands = Commands()

    @classmethod
    async def create(cls, **kwargs):
        cls.created_with = kwargs
        return cls()

    def get_host(self, port):
        return f"{port}-sbx.e2b.app"

    async def is_running(self):
        return self.running

    async def set_timeout(self, timeout):
        self.timeouts.append(timeout)


def test_e2b_environment_is_private_and_runs_servers_in_the_background(monkeypatch):
    import e2b

    monkeypatch.setattr(e2b, "AsyncSandbox", FakeAsyncSandbox)
    env = sandbox.new_environment()
    asyncio.run(env.initialize())
    assert FakeAsyncSandbox.created_with["network"] == {"allow_public_traffic": False}
    assert FakeAsyncSandbox.created_with["envs"] == sandbox.SANDBOX_ENV

    assert env.endpoint(8000) == ("https://8000-sbx.e2b.app", {"e2b-traffic-access-token": "traffic-token"})

    pid = asyncio.run(env.start_background("exec python3 run_adk.py", cwd="/home/user/p", envs={"API_KEY": "k"}))
    fake = env._sandbox
    assert pid == 77 and fake.handle.disconnected
    run = fake.runs[0]
    assert run["background"] is True and run["timeout"] == 0
    assert run["cwd"] == "/home/user/p" and run["envs"] == {"API_KEY": "k"}

    asyncio.run(env.kill(77))
    assert fake.killed == [77]

    assert asyncio.run(env.keepalive()) is True
    assert fake.timeouts[-1] == env._timeout
    fake.running = False
    assert asyncio.run(env.keepalive()) is False


# ── start / stop ──────────────────────────────────────────────────────


def test_start_preview_runs_the_project_server_with_a_capped_key(monkeypatch, preview_env):
    _use(monkeypatch)
    monkeypatch.setenv("OPENROUTER_API_KEY", "server-secret")
    ctx = _ctx()
    result = asyncio.run(start_preview(ctx))
    assert result["status"] == "running", result
    assert [s["step"] for s in result["steps"]] == ["python", "install", "start"]

    env = ScriptedEnvironment.instances[0]
    started = env.background[0]
    assert started["cwd"] == "/home/user/projects/support-triage"
    assert "run_adk.py" in started["command"]
    envs = started["envs"]
    assert envs["OPENROUTER_API_KEY"] == "sk-or-capped-1"  # ours, capped: never the server's
    assert envs["API_KEY"] and envs["PORT"] == str(sandbox.PREVIEW_PORT)
    assert envs["DEV_MODE"] == "true"
    assert float(envs["COST_GUARD_BUDGET"]) == pytest.approx(openrouter_keys.LIMIT_USD)
    assert "server-secret" not in json.dumps(envs)

    state = ctx.state[sandbox.PREVIEW_STATE_KEY]
    assert state["status"] == "running" and state["package"] == "support_triage"
    assert "api" not in json.dumps(state).lower()  # no URL or key in session state
    box = sandbox.find(workspace.session_key("u_123", "s1"))
    assert box.preview.pid == 4242 and box.preview.key_hash == "hash-1"


def test_restart_replaces_the_server_and_the_key(monkeypatch, preview_env):
    _use(monkeypatch)
    ctx = _ctx()
    asyncio.run(start_preview(ctx))
    asyncio.run(start_preview(ctx))
    env = ScriptedEnvironment.instances[0]
    assert env.killed == [4242]
    assert preview_env.deleted == ["hash-1"]
    assert sandbox.find(workspace.session_key("u_123", "s1")).preview.key_hash == "hash-2"


def test_a_server_that_never_answers_releases_its_key(monkeypatch, preview_env):
    _use(monkeypatch, {
        "urllib.request.urlopen": ExecutionResult(exit_code=2),
        "tail -c": ExecutionResult(exit_code=0, stdout="ModuleNotFoundError: No module named 'httpx'"),
    })
    ctx = _ctx()
    result = asyncio.run(start_preview(ctx))
    assert result["status"] == "failed"
    assert result["steps"][-1]["note"] == "The server exited before answering /health."
    assert "httpx" in result["steps"][-1]["stderr"]
    assert preview_env.deleted == ["hash-1"]
    assert sandbox.find(workspace.session_key("u_123", "s1")).preview is None
    assert sandbox.PREVIEW_STATE_KEY not in ctx.state


def test_anonymous_users_cannot_preview(monkeypatch, preview_env):
    _use(monkeypatch)
    result = asyncio.run(start_preview(_ctx(user_id="a_anon")))
    assert result["status"] == "sign_in_required"
    assert preview_env.created == []


def test_stop_preview_kills_the_server_and_deletes_the_key(monkeypatch, preview_env):
    _use(monkeypatch)
    ctx = _ctx()
    asyncio.run(start_preview(ctx))
    assert asyncio.run(stop_preview(ctx)) == {"status": "stopped"}
    assert ScriptedEnvironment.instances[0].killed == [4242]
    assert preview_env.deleted == ["hash-1"]
    assert ctx.state[sandbox.PREVIEW_STATE_KEY] == {"status": "stopped"}
    assert asyncio.run(stop_preview(ctx)) == {"status": "not_running"}


def test_closing_the_sandbox_deletes_the_key(monkeypatch, preview_env):
    _use(monkeypatch)
    asyncio.run(start_preview(_ctx()))
    asyncio.run(sandbox.close_all())
    assert preview_env.deleted == ["hash-1"]
    assert ScriptedEnvironment.instances[0].closed


# ── the proxy ─────────────────────────────────────────────────────────


class FakePreviewServer:
    """The generated agent's server behind the private sandbox port."""

    def __init__(self):
        self.sessions: set[str] = set()
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        assert request.headers["e2b-traffic-access-token"] == "traffic-token"
        assert request.headers["authorization"].startswith("Bearer ")
        path = request.url.path
        if path.startswith("/apps/support_triage/users/preview/sessions/"):
            sid = path.rsplit("/", 1)[-1]
            if request.method == "GET":
                return httpx.Response(200 if sid in self.sessions else 404, json={"id": sid})
            self.sessions.add(sid)
            return httpx.Response(200, json={"id": sid})
        if path == "/run_sse":
            event = {"author": "support_triage", "content": {"parts": [{"text": "Hi from the preview"}]}}
            return httpx.Response(
                200, headers={"content-type": "text/event-stream"}, content=f"data: {json.dumps(event)}\n\n"
            )
        return httpx.Response(404)


@pytest.fixture
def proxy(monkeypatch):
    server = FakePreviewServer()
    monkeypatch.setattr(
        preview_api, "_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(server.handler))
    )
    app = FastAPI()
    app.include_router(preview_api.router)
    return TestClient(app), server


def _running_preview(monkeypatch):
    _use(monkeypatch)
    ctx = _ctx()
    asyncio.run(start_preview(ctx))
    return sandbox.find(workspace.session_key("u_123", "s1"))


def test_proxy_streams_the_preview_agent(monkeypatch, proxy):
    client, server = proxy
    box = _running_preview(monkeypatch)
    response = client.post(
        "/builder/preview/u_123/s1/run_sse", json={"previewSessionId": "p-1", "text": "Hello"}
    )
    assert response.status_code == 200
    assert "Hi from the preview" in response.text

    get, create, run = server.requests
    assert get.method == "GET" and create.method == "POST"  # session recreated by id
    assert get.headers["authorization"] == f"Bearer {box.preview.api_key}"
    body = json.loads(run.content)
    assert body["appName"] == "support_triage" and body["userId"] == "preview"
    assert body["sessionId"] == "p-1" and body["newMessage"]["parts"][0]["text"] == "Hello"

    client.post("/builder/preview/u_123/s1/run_sse", json={"previewSessionId": "p-1", "text": "Again"})
    assert [r.method for r in server.requests[3:]] == ["GET", "POST"]  # session exists: no create
    assert box.preview.messages == 2


def test_proxy_status_and_stop(monkeypatch, proxy, preview_env):
    client, _server = proxy
    assert client.get("/builder/preview/u_123/s1").json() == {"running": False}
    _running_preview(monkeypatch)
    status = client.get("/builder/preview/u_123/s1").json()
    assert status["running"] and status["package"] == "support_triage"
    assert "apiKey" not in status and "url" not in json.dumps(status)
    assert client.delete("/builder/preview/u_123/s1").json() == {"stopped": True}
    assert preview_env.deleted == ["hash-1"]
    assert client.get("/builder/preview/u_123/s1").json() == {"running": False}


def test_proxy_refuses_without_a_preview_or_over_the_limit(monkeypatch, proxy):
    client, _server = proxy
    payload = {"previewSessionId": "p-1", "text": "Hello"}
    assert client.post("/builder/preview/u_123/s1/run_sse", json=payload).status_code == 404
    # Another user's session id does not reach this user's preview.
    _running_preview(monkeypatch)
    assert client.post("/builder/preview/u_999/s1/run_sse", json=payload).status_code == 404
    monkeypatch.setattr(sandbox, "PREVIEW_MAX_MESSAGES", 1)
    assert client.post("/builder/preview/u_123/s1/run_sse", json=payload).status_code == 200
    assert client.post("/builder/preview/u_123/s1/run_sse", json=payload).status_code == 429


def test_proxy_notices_an_expired_sandbox(monkeypatch, proxy, preview_env):
    client, _server = proxy
    box = _running_preview(monkeypatch)
    box.env.alive = False
    response = client.post("/builder/preview/u_123/s1/run_sse", json={"previewSessionId": "p", "text": "x"})
    assert response.status_code == 410
    assert box.preview is None
    assert preview_env.deleted == ["hash-1"]


def test_proxy_validates_input(proxy):
    client, _server = proxy
    assert client.post("/builder/preview/u_1/s1/run_sse", json={"previewSessionId": "../x", "text": "a"}).status_code == 422
    assert client.post("/builder/preview/u_1/s1/run_sse", json={"previewSessionId": "p", "text": ""}).status_code == 422
    assert client.post(
        "/builder/preview/u_1/s1/run_sse", json={"previewSessionId": "p", "text": "x" * 5000}
    ).status_code == 422


# ── a real boot ───────────────────────────────────────────────────────


class LocalPreviewSandbox(LocalSandbox):
    """LocalSandbox that can run a background server, standing in for E2B."""

    async def start_background(self, command, *, cwd, envs):
        process = await asyncio.create_subprocess_shell(
            command, cwd=cwd, env={**os.environ, **envs}, start_new_session=True,
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        return process.pid

    async def kill(self, pid):
        try:
            os.killpg(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    def endpoint(self, port):
        return f"http://127.0.0.1:{port}", {}

    async def keepalive(self):
        return True


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_a_generated_server_boots_and_requires_its_key(tmp_path, monkeypatch):
    box_dir = tmp_path / "sandbox"
    monkeypatch.setattr(sandbox, "new_environment", lambda: LocalPreviewSandbox(working_dir=box_dir))
    monkeypatch.setattr(sandbox, "PYTHON", sys.executable)
    port = _free_port()
    monkeypatch.setattr(sandbox, "PREVIEW_PORT", port)
    monkeypatch.setattr(sandbox, "PREVIEW_START_TIMEOUT", 60)
    ctx = _ctx()

    result = asyncio.run(start_preview(ctx))
    try:
        assert result["status"] == "running", result
        box = sandbox.find(workspace.session_key("u_123", "s1"))
        sessions = f"http://127.0.0.1:{port}/apps/support_triage/users/preview/sessions/p-1"
        assert httpx.get(f"http://127.0.0.1:{port}/health").status_code == 200
        assert httpx.get(sessions).status_code == 401  # the per-start API key is enforced
        authed = {"Authorization": f"Bearer {box.preview.api_key}"}
        assert httpx.get(sessions, headers=authed).status_code == 404
        assert httpx.post(sessions, headers=authed, json={}).status_code == 200
    finally:
        asyncio.run(stop_preview(ctx))
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            httpx.get(f"http://127.0.0.1:{port}/health", timeout=0.5)
        except httpx.HTTPError:
            break
        time.sleep(0.2)
    else:
        pytest.fail("the preview server kept running after stop_preview")
    asyncio.run(sandbox.close_all())
