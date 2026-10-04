"""Run a builder project in an E2B sandbox, never on this server.

Generated code is written by a model that anonymous visitors steer. It must
not run where the server's secrets, database and other users' workspaces are.
Each chat session gets one disposable E2B sandbox (through ADK's
E2BEnvironment) holding the project files and nothing else: no server
environment variable is forwarded.

The backend workspace stays the source of truth. Every run re-uploads the
project, because E2B recreates an expired sandbox without its files. For the
same reason the "requirements installed" marker lives inside the sandbox.

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
import shlex
import tarfile
import time
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, AsyncIterator

from . import workspace
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


def may_run(user_id: str) -> bool:
    """Only signed-in users (web app ids `u_<id>`) run code, unless switched off."""
    if os.getenv("BUILDER_SANDBOX_SIGNED_IN_ONLY", "1").strip().lower() in ("0", "false", "no"):
        return True
    return str(user_id).startswith("u_")


def new_environment() -> Any:
    """A fresh, uninitialised sandbox environment. Tests replace this."""
    from google.adk.integrations.e2b import E2BEnvironment

    return E2BEnvironment(
        image=TEMPLATE,
        # The TTL must outlast the longest command, or E2B kills the sandbox mid-run.
        timeout=max(TTL_SECONDS, INSTALL_TIMEOUT + 60, COMMAND_TIMEOUT + 60),
        env_vars=dict(SANDBOX_ENV),
    )


@dataclass
class _Sandbox:
    env: Any
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    last_used: float = field(default_factory=time.monotonic)


_active: dict[str, _Sandbox] = {}


async def _close(box: _Sandbox) -> None:
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
async def open_session(key: str) -> AsyncIterator[Any]:
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
            yield box.env
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
    """Replace the sandbox copy of the project with the workspace's files."""
    projects, builder = _layout(env)
    upload = builder / "upload.tar.gz"
    remote = projects / name
    await env.write_file(str(upload), _tarball(project, name))
    result = await env.execute(
        f"rm -rf {_q(remote)} && mkdir -p {_q(projects)} "
        f"&& tar -xzf {_q(upload)} -C {_q(projects)} && rm -f {_q(upload)}",
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


async def check_project(env: Any, project: Path, name: str, package: str) -> list[dict]:
    """Upload, then Python version, install, import the agent, pytest; stop at the first failure."""
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
        return steps

    install = await _install(env, project, remote)
    steps.append(install)
    if not install["ok"]:
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
