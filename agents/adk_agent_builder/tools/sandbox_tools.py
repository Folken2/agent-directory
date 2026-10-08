"""Tools that run the current project in an isolated E2B sandbox.

run_checks and run_in_sandbox are registered when the server has E2B_API_KEY;
start_preview and stop_preview also need OPENROUTER_MANAGEMENT_KEY (see
tools/__init__.py). Only signed-in users may run code; runs per chat are
capped. See sandbox.py and preview_api.py.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext

from .. import sandbox, workspace
from ..sandbox import SandboxError
from ..workspace import WorkspaceError

logger = logging.getLogger(__name__)

MAX_COMMAND_CHARS = 2000


def _error(message: str, **extra: Any) -> dict:
    return {"status": "error", "message": message, **extra}


def _start_run(tool_context: ToolContext) -> dict | None:
    """Gate and count one sandbox run; a dict means "do not run" and is the reply."""
    if not sandbox.enabled():
        return _error("The sandbox is not configured on this server.")
    if not sandbox.may_run(workspace.user_id_for(tool_context)):
        return {
            "status": "sign_in_required",
            "message": (
                "Running code needs a signed-in account. The project can still be "
                "validated and downloaded."
            ),
        }
    runs = int(tool_context.state.get(sandbox.RUNS_STATE_KEY) or 0)
    if runs >= sandbox.MAX_RUNS:
        return _error(f"This chat has used all {sandbox.MAX_RUNS} sandbox runs.")
    tool_context.state[sandbox.RUNS_STATE_KEY] = runs + 1
    return None


def _runs_left(tool_context: ToolContext) -> int:
    return max(sandbox.MAX_RUNS - int(tool_context.state.get(sandbox.RUNS_STATE_KEY) or 0), 0)


async def run_checks(tool_context: ToolContext) -> dict:
    """Run the current project in an isolated sandbox and report what fails.

    Uploads the project, checks Python, installs requirements.txt (skipped when
    unchanged), imports `<package>.agent`, then runs pytest. Stops at the first
    failing step. Call it after validate_agent passes; fix what fails and call it
    again before package_agent. The sandbox has no API keys, so tests must mock
    LLM and external API calls.
    """
    try:
        name, project = workspace.current_project(tool_context)
    except WorkspaceError as exc:
        return _error(str(exc))
    stop = _start_run(tool_context)
    if stop:
        return stop

    package = tool_context.state.get(workspace.PROJECT_PACKAGE_KEY) or ""
    try:
        async with sandbox.open_session(workspace.session_key_for(tool_context)) as box:
            steps = await sandbox.check_project(box.env, project, name, package)
    except SandboxError as exc:
        return _error(str(exc))
    except Exception as exc:  # E2B API errors, network
        logger.error("run_checks failed: %s", exc)
        return _error("The sandbox failed unexpectedly. Try run_checks again.")

    passed = len(steps) == 4 and all(step["ok"] for step in steps)
    return {
        "status": "passed" if passed else "failed",
        "steps": steps,
        "runs_left": _runs_left(tool_context),
    }


async def run_in_sandbox(command: str, tool_context: ToolContext) -> dict:
    """Run one shell command in the project root inside the isolated sandbox.

    The latest project files are uploaded first. Use it to dig into a failure,
    e.g. "python3 -m pytest tests/test_tools.py -x -vv" or "pip show litellm".
    Requirements are installed by run_checks; call that first. The sandbox has no
    API keys and is deleted after a while.

    Args:
        command: Shell command, run with the project root as the working directory.
    """
    if not command or not command.strip():
        return _error("Give a command to run.")
    if len(command) > MAX_COMMAND_CHARS:
        return _error(f"Commands are limited to {MAX_COMMAND_CHARS} characters.")
    try:
        name, project = workspace.current_project(tool_context)
    except WorkspaceError as exc:
        return _error(str(exc))
    stop = _start_run(tool_context)
    if stop:
        return stop

    try:
        async with sandbox.open_session(workspace.session_key_for(tool_context)) as box:
            remote = await sandbox.sync_project(box.env, project, name)
            result = await sandbox.run_command(box.env, remote, command, sandbox.COMMAND_TIMEOUT)
    except SandboxError as exc:
        return _error(str(exc))
    except Exception as exc:
        logger.error("run_in_sandbox failed: %s", exc)
        return _error("The sandbox failed unexpectedly. Try again.")

    # The command's exit code is its result, not a tool failure, so it is nested:
    # nuvel's RepeatedFailureGuard halts on a top-level non-zero exit_code and
    # would stop a normal edit-and-rerun loop.
    outcome = {
        "exit_code": result.exit_code,
        "stdout": sandbox.tail(result.stdout),
        "stderr": sandbox.tail(result.stderr),
    }
    if result.timed_out:
        outcome["timed_out"] = True
    return {"status": "ok", "result": outcome, "runs_left": _runs_left(tool_context)}


async def start_preview(tool_context: ToolContext) -> dict:
    """Start (or restart) a live preview of the current project next to the chat.

    Uploads the latest files, installs requirements and runs the project's own
    server in the sandbox with a capped model key. The user then chats with
    their agent in the preview panel. Call it after run_checks passes, and
    again after you change files so the panel runs the latest version.
    """
    try:
        name, project = workspace.current_project(tool_context)
    except WorkspaceError as exc:
        return _error(str(exc))
    stop = _start_run(tool_context)
    if stop:
        return stop

    package = tool_context.state.get(workspace.PROJECT_PACKAGE_KEY) or ""
    key = workspace.session_key_for(tool_context)
    try:
        async with sandbox.open_session(key) as box:
            steps = await sandbox.start_preview(box, project, name, package, f"adk-builder-preview-{key[:12]}")
    except SandboxError as exc:
        return _error(str(exc))
    except Exception as exc:
        logger.error("start_preview failed: %s", exc)
        return _error("The preview failed to start unexpectedly. Try again.")

    running = bool(steps) and steps[-1]["step"] == "start" and steps[-1]["ok"]
    if running:
        tool_context.state[sandbox.PREVIEW_STATE_KEY] = {
            "status": "running",
            "project": name,
            "package": package,
            "startedAt": datetime.now(timezone.utc).isoformat(),
        }
    return {
        "status": "running" if running else "failed",
        "steps": steps,
        "runs_left": _runs_left(tool_context),
        **({"next": "Tell the user the preview panel is open next to the chat."} if running else {}),
    }


async def stop_preview(tool_context: ToolContext) -> dict:
    """Stop the live preview and release its model key."""
    box = sandbox.find(workspace.session_key_for(tool_context))
    stopped = False
    if box is not None:
        async with box.lock:
            stopped = await sandbox.stop_preview(box)
    if tool_context.state.get(sandbox.PREVIEW_STATE_KEY):
        tool_context.state[sandbox.PREVIEW_STATE_KEY] = {"status": "stopped"}
    return {"status": "stopped" if stopped else "not_running"}


run_checks_tool = FunctionTool(func=run_checks)
run_in_sandbox_tool = FunctionTool(func=run_in_sandbox)
start_preview_tool = FunctionTool(func=start_preview)
stop_preview_tool = FunctionTool(func=stop_preview)
