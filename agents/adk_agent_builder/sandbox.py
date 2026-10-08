"""Run a builder project in an E2B sandbox, never on this server.

Generated code is written by a model that anonymous visitors steer. It must
not run where the server's secrets, database and other users' workspaces are.
Each chat session gets one disposable E2B sandbox (through ADK's
E2BEnvironment) holding the project files and nothing else: no server
environment variable is forwarded.

The backend workspace stays the source of truth. Every run re-uploads the
project, because E2B recreates an expired sandbox without its files. For the
same reason the "requirements installed" marker lives inside the sandbox.

A preview runs the project's own server in the sandbox on a private port: E2B
only lets requests through with the sandbox's traffic token, and the server
wants a per-start API key. Only preview_api.py, on this server, holds both.

See docs/superpowers/specs/2026-10-04-builder-sandbox-design.md.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import io
import logging
import os
import re
import secrets
import shlex
import tarfile
import time
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, AsyncIterator

from google.adk.integrations.e2b import E2BEnvironment

from . import openrouter_keys, workspace
from .openrouter_keys import PreviewKeyError
from .workspace import int_env

logger = logging.getLogger(__name__)

TEMPLATE = os.getenv("BUILDER_E2B_TEMPLATE") or "base"
TTL_SECONDS = int_env("BUILDER_SANDBOX_TTL", 900)
INSTALL_TIMEOUT = int_env("BUILDER_SANDBOX_INSTALL_TIMEOUT", 600)
COMMAND_TIMEOUT = int_env("BUILDER_SANDBOX_COMMAND_TIMEOUT", 300)
MAX_RUNS = int_env("BUILDER_SANDBOX_MAX_RUNS", 30)
MAX_ACTIVE = int_env("BUILDER_SANDBOX_MAX_ACTIVE", 10)
PYTHON = os.getenv("BUILDER_SANDBOX_PYTHON") or "python3"
OUTPUT_TAIL_CHARS = 3000
RUNS_STATE_KEY = "builder:sandbox_runs"
PREVIEW_STATE_KEY = "builder:preview"
PREVIEW_PORT = 8000
PREVIEW_START_TIMEOUT = int_env("BUILDER_PREVIEW_START_TIMEOUT", 90)
PREVIEW_MAX_MESSAGES = int_env("BUILDER_PREVIEW_MAX_MESSAGES", 60)

# The sandbox's whole environment. Never forward the server's variables.
SANDBOX_ENV = {
    "DEV_MODE": "true",
    "PYTHONDONTWRITEBYTECODE": "1",
    "PYTHONUNBUFFERED": "1",
    "PIP_DISABLE_PIP_VERSION_CHECK": "1",
}

# Installed next to the project's requirements so its tests can run.
TEST_REQUIREMENTS = ("pytest", "pytest-asyncio")

_PACKAGE_RE = re.compile(r"^[a-z][a-z0-9_]*$")


class SandboxError(Exception):
    """The sandbox could not do its part; the message is safe to show the model."""


def enabled() -> bool:
    """The sandbox tools exist only when the server has an E2B key."""
    return bool(os.getenv("E2B_API_KEY"))


def preview_enabled() -> bool:
    """Previews also need our OpenRouter management key for the capped model key."""
    return enabled() and openrouter_keys.enabled()


def may_run(user_id: str) -> bool:
    """Only signed-in users (web app ids `u_<id>`) run code, unless switched off."""
    if os.getenv("BUILDER_SANDBOX_SIGNED_IN_ONLY", "1").strip().lower() in ("0", "false", "no"):
        return True
    return str(user_id).startswith("u_")


class PrivateE2BEnvironment(E2BEnvironment):
    """ADK's E2BEnvironment with private ports, and what the preview proxy needs.

    Overrides ADK's _create_sandbox (google-adk 2.10) to pass
    network={"allow_public_traffic": False}: the sandbox's URLs then answer only
    requests that carry its traffic access token.
    """

    async def _create_sandbox(self):
        from e2b import AsyncSandbox

        return await AsyncSandbox.create(
            template=self._image,
            timeout=self._timeout,
            envs=self._env_vars,
            api_key=self._api_key,
            network={"allow_public_traffic": False},
        )

    def endpoint(self, port: int) -> tuple[str, dict[str, str]]:
        """Base URL of a sandbox port and the header that lets a request through."""
        if self._sandbox is None:
            raise SandboxError("The sandbox is not running.")
        headers = {}
        if self._sandbox.traffic_access_token:
            headers["e2b-traffic-access-token"] = self._sandbox.traffic_access_token
        return f"https://{self._sandbox.get_host(port)}", headers

    async def start_background(self, command: str, *, cwd: str, envs: dict[str, str]) -> int:
        """Start a long-running command (E2B's background mode); returns its pid.

        Secrets go in `envs`, so they are neither written to disk nor part of
        the command line.
        """
        sandbox = await self._ensure_sandbox()
        handle = await sandbox.commands.run(command, background=True, cwd=cwd, envs=envs, timeout=0)
        await handle.disconnect()
        return handle.pid

    async def kill(self, pid: int) -> None:
        if self._sandbox is not None:
            await self._sandbox.commands.kill(pid)

    async def keepalive(self) -> bool:
        """Extend the TTL. False when E2B has already ended the sandbox."""
        if self._sandbox is None:
            return False
        try:
            if not await self._sandbox.is_running():
                return False
            await self._sandbox.set_timeout(self._timeout)
            return True
        except Exception as exc:
            logger.warning("Sandbox keepalive failed: %s", exc)
            return False


def new_environment() -> Any:
    """A fresh, uninitialised sandbox environment. Tests replace this."""
    return PrivateE2BEnvironment(
        image=TEMPLATE,
        # The TTL must outlast the longest command, or E2B kills the sandbox mid-run.
        timeout=max(TTL_SECONDS, INSTALL_TIMEOUT + 60, COMMAND_TIMEOUT + 60),
        env_vars=dict(SANDBOX_ENV),
    )


@dataclass
class Preview:
    """A running preview. Lives only in this process; never in session state."""

    project: str
    package: str
    api_key: str
    key_hash: str
    pid: int
    started_at: float = field(default_factory=time.time)
    messages: int = 0


@dataclass
class _Sandbox:
    env: Any
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    last_used: float = field(default_factory=time.monotonic)
    preview: Preview | None = None


_active: dict[str, _Sandbox] = {}


def find(key: str) -> _Sandbox | None:
    """The session's sandbox if one is open (the preview proxy's lookup)."""
    return _active.get(key)


async def _close(box: _Sandbox) -> None:
    if box.preview:
        await openrouter_keys.delete_key(box.preview.key_hash)
        box.preview = None
    try:
        await box.env.close()
    except Exception as exc:  # E2B already killed it, network blip, ...
        logger.warning("Closing a sandbox failed: %s", exc)


async def _reap_idle(now: float) -> None:
    for key, box in list(_active.items()):
        if now - box.last_used > TTL_SECONDS and not box.lock.locked():
            _active.pop(key, None)
            await _close(box)


@contextlib.asynccontextmanager
async def open_session(key: str) -> AsyncIterator[_Sandbox]:
    """The session's sandbox, started on first use; one caller at a time."""
    await _reap_idle(time.monotonic())
    box = _active.get(key)
    if box is None:
        if len(_active) >= MAX_ACTIVE:
            raise SandboxError("Every sandbox is in use right now. Try again in a few minutes.")
        box = _active[key] = _Sandbox(env=new_environment())

    async with box.lock:
        if not box.env.is_initialized:
            try:
                await box.env.initialize()
            except Exception as exc:
                _active.pop(key, None)
                logger.error("Starting a sandbox failed: %s", exc)
                raise SandboxError("Could not start a sandbox. Try again shortly.") from exc
        try:
            yield box
        finally:
            box.last_used = time.monotonic()


async def close_all() -> None:
    """Close every sandbox this process started (shutdown, tests)."""
    boxes = list(_active.values())
    _active.clear()
    for box in boxes:
        await _close(box)


def _q(path: Any) -> str:
    return shlex.quote(str(path))


def tail(text: str, limit: int = OUTPUT_TAIL_CHARS) -> str:
    text = text or ""
    return text if len(text) <= limit else "…" + text[-limit:]


def _layout(env: Any) -> tuple[PurePosixPath, PurePosixPath]:
    root = PurePosixPath(str(env.working_dir))
    return root / "projects", root / ".builder"


def _tarball(project: Path, name: str) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for rel in workspace.project_files(project):
            archive.add(project / rel, arcname=f"{name}/{rel}", recursive=False)
    return buffer.getvalue()


async def sync_project(env: Any, project: Path, name: str) -> PurePosixPath:
    """Bring the sandbox copy of the project in line with the workspace.

    Updated in place, so a running preview keeps its working directory:
    uploaded files are overwritten, and files uploaded last time but gone from
    the workspace are removed. Files the running code created stay.
    """
    projects, builder = _layout(env)
    files = workspace.project_files(project)
    upload = builder / "upload.tar.gz"
    remote = projects / name
    manifest = builder / f"{name}.manifest"
    incoming = builder / f"{name}.manifest.new"
    await env.write_file(str(upload), _tarball(project, name))
    await env.write_file(str(incoming), "".join(f"{rel}\n" for rel in files))
    prune = (
        f"if [ -f {_q(manifest)} ]; then sort {_q(manifest)} > {_q(builder / 'old')} "
        f"&& sort {_q(incoming)} > {_q(builder / 'new')} "
        f"&& comm -23 {_q(builder / 'old')} {_q(builder / 'new')} "
        f"| while IFS= read -r f; do rm -f -- {_q(remote)}/\"$f\"; done; fi"
    )
    result = await env.execute(
        f"mkdir -p {_q(projects)} && tar -xzf {_q(upload)} -C {_q(projects)} && rm -f {_q(upload)} "
        f"&& {prune} && mv {_q(incoming)} {_q(manifest)}",
        timeout=120,
    )
    if result.exit_code != 0 or result.timed_out:
        raise SandboxError(
            "Could not upload the project to the sandbox: " + tail(result.stderr or result.stdout, 500)
        )
    return remote


def _step(name: str, result: Any, ok: bool, note: str = "") -> dict:
    step = {
        "step": name,
        "ok": ok,
        "exit_code": result.exit_code,
        "stdout": tail(result.stdout),
        "stderr": tail(result.stderr),
    }
    if result.timed_out:
        step["timed_out"] = True
    if note:
        step["note"] = note
    return step


async def run_command(env: Any, remote: PurePosixPath, command: str, timeout: float) -> Any:
    return await env.execute(f"cd {_q(remote)} && {command}", timeout=timeout)


async def _install(env: Any, project: Path, remote: PurePosixPath) -> dict:
    """pip install the project's requirements, unless this sandbox already has them."""
    requirements = project / "requirements.txt"
    content = requirements.read_bytes() if requirements.is_file() else b""
    digest = hashlib.sha256(content + " ".join(TEST_REQUIREMENTS).encode()).hexdigest()[:16]
    _projects, builder = _layout(env)
    marker = builder / f"requirements-{digest}.ok"

    if (await env.execute(f"test -f {_q(marker)}", timeout=30)).exit_code == 0:
        return {"step": "install", "ok": True, "note": "Requirements unchanged; already installed."}

    sources = "-r requirements.txt " if content else ""
    result = await run_command(
        env,
        remote,
        f"{PYTHON} -m pip install -q {sources}{' '.join(TEST_REQUIREMENTS)} "
        f"&& mkdir -p {_q(builder)} && touch {_q(marker)}",
        INSTALL_TIMEOUT,
    )
    return _step("install", result, result.exit_code == 0 and not result.timed_out)


async def _prepare(env: Any, project: Path, name: str, package: str) -> tuple[PurePosixPath, list[dict]]:
    """Upload, check Python, install requirements. Steps end early on a failure."""
    if not _PACKAGE_RE.match(package or ""):
        raise SandboxError(f"Invalid package name: {package!r}")
    remote = await sync_project(env, project, name)
    steps: list[dict] = []

    result = await run_command(
        env, remote, f'{PYTHON} -c "import sys; print(sys.version); assert sys.version_info >= (3, 11)"', 60
    )
    ok = result.exit_code == 0 and not result.timed_out
    steps.append(_step(
        "python", result, ok,
        "" if ok else "The sandbox needs Python 3.11+. Build the builder's E2B template "
        "(python -m adk_agent_builder.sandbox_template) and set BUILDER_E2B_TEMPLATE.",
    ))
    if not ok:
        return remote, steps

    steps.append(await _install(env, project, remote))
    return remote, steps


def _all_ok(steps: list[dict]) -> bool:
    return all(step["ok"] for step in steps)


async def check_project(env: Any, project: Path, name: str, package: str) -> list[dict]:
    """Upload, then Python version, install, import the agent, pytest; stop at the first failure."""
    remote, steps = await _prepare(env, project, name, package)
    if not _all_ok(steps):
        return steps

    result = await run_command(env, remote, f'{PYTHON} -c "import {package}.agent"', COMMAND_TIMEOUT)
    steps.append(_step("import", result, result.exit_code == 0 and not result.timed_out))
    if not steps[-1]["ok"]:
        return steps

    result = await run_command(env, remote, f"{PYTHON} -m pytest -q -p no:cacheprovider", COMMAND_TIMEOUT)
    # pytest exits 5 when it collects no tests: nothing failed, but say so.
    no_tests = result.exit_code == 5
    steps.append(_step(
        "tests", result, (result.exit_code == 0 or no_tests) and not result.timed_out,
        "No tests were collected." if no_tests else "",
    ))
    return steps


async def stop_preview(box: _Sandbox) -> bool:
    """Stop the session's preview server and delete its model key."""
    preview = box.preview
    if preview is None:
        return False
    box.preview = None
    try:
        await box.env.kill(preview.pid)
    except Exception as exc:  # already exited, or the sandbox is gone
        logger.info("Stopping preview pid %s: %s", preview.pid, exc)
    await openrouter_keys.delete_key(preview.key_hash)
    return True


async def start_preview(box: _Sandbox, project: Path, name: str, package: str, key_name: str) -> list[dict]:
    """(Re)start the project's own server in the sandbox on a private port.

    Upload, check Python, install, then run `run_adk.py` in DEV_MODE (in-memory
    sessions, agent hot reload) with a per-start API key and a capped OpenRouter
    key, and wait for /health. On success the preview is recorded on `box`.
    """
    env = box.env
    await stop_preview(box)
    remote, steps = await _prepare(env, project, name, package)
    if not _all_ok(steps):
        return steps

    try:
        model_key = await openrouter_keys.create_key(key_name)
    except PreviewKeyError as exc:
        raise SandboxError(str(exc)) from exc

    _projects, builder = _layout(env)
    log = builder / "preview.log"
    api_key = secrets.token_urlsafe(32)
    envs = {
        **SANDBOX_ENV,
        "PORT": str(PREVIEW_PORT),
        "API_KEY": api_key,
        "OPENROUTER_API_KEY": model_key.key,
        # nuvel's CostGuard in the generated agent: a second cap on the same budget.
        "COST_GUARD_BUDGET": f"{openrouter_keys.LIMIT_USD:.2f}",
    }
    try:
        pid = await env.start_background(
            f"exec {PYTHON} run_adk.py > {_q(log)} 2>&1", cwd=str(remote), envs=envs
        )
    except Exception as exc:
        await openrouter_keys.delete_key(model_key.hash)
        logger.error("Starting the preview server failed: %s", exc)
        raise SandboxError("Could not start the preview server. Try again shortly.") from exc

    health = f"http://127.0.0.1:{PREVIEW_PORT}/health"
    wait = await env.execute(
        f"for i in $(seq 1 {PREVIEW_START_TIMEOUT}); do "
        f"kill -0 {pid} 2>/dev/null || exit 2; "
        f"{PYTHON} -c \"import urllib.request; urllib.request.urlopen('{health}', timeout=2)\" "
        f"2>/dev/null && exit 0; sleep 1; done; exit 1",
        timeout=PREVIEW_START_TIMEOUT + 30,
    )
    if wait.exit_code == 0 and not wait.timed_out:
        box.preview = Preview(project=name, package=package, api_key=api_key, key_hash=model_key.hash, pid=pid)
        steps.append({"step": "start", "ok": True, "note": "The preview server is up."})
        return steps

    logs = await env.execute(f"tail -c {OUTPUT_TAIL_CHARS} {_q(log)}", timeout=30)
    try:
        await env.kill(pid)
    except Exception:
        pass
    await openrouter_keys.delete_key(model_key.hash)
    steps.append({
        "step": "start",
        "ok": False,
        "note": (
            "The server exited before answering /health."
            if wait.exit_code == 2
            else f"The server did not answer /health within {PREVIEW_START_TIMEOUT}s."
        ),
        "stderr": tail(logs.stdout),
    })
    return steps
