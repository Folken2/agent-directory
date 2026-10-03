"""Per-session workspace where the builder stamps out agent projects.

Every chat session gets its own directory under BUILDER_WORKSPACE_DIR, named
from a hash of the user and session ids. The tools derive that path on the
server for each call; session state only carries the project's kebab-case
name, which must pass nuvel's name check. Nothing a client puts in state can
point the file tools outside the session's own directory.

Workspaces are scratch space: the deliverable is the zip the builder saves
as an artifact. Directories idle for BUILDER_WORKSPACE_TTL_HOURS are deleted.
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any, Optional

from nuvel.backends.adk.scaffold import validate_agent_name

logger = logging.getLogger(__name__)


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


ROOT = Path(os.getenv("BUILDER_WORKSPACE_DIR") or Path(tempfile.gettempdir()) / "adk-agent-builder")
TTL_SECONDS = _int_env("BUILDER_WORKSPACE_TTL_HOURS", 24) * 3600
MAX_PROJECTS_PER_SESSION = _int_env("BUILDER_MAX_PROJECTS", 3)
MAX_FILE_BYTES = _int_env("BUILDER_MAX_FILE_BYTES", 256 * 1024)
MAX_PROJECT_BYTES = _int_env("BUILDER_MAX_PROJECT_BYTES", 8 * 1024 * 1024)
MAX_PROJECT_FILES = _int_env("BUILDER_MAX_PROJECT_FILES", 400)

# Same keys nuvel's meta-agent uses, so nuvel's path_guard can correct
# paths like "<agent-name>/tools/x.py". Names only, never filesystem paths.
PROJECT_NAME_KEY = "current_agent_name"
PROJECT_PACKAGE_KEY = "current_agent_package"


class WorkspaceError(Exception):
    """A tool-facing error; the message is safe to show the model."""


def session_dir(user_id: str, session_id: str) -> Path:
    digest = hashlib.sha256(f"{user_id}\0{session_id}".encode("utf-8")).hexdigest()[:32]
    return ROOT / digest


def session_dir_for(tool_context: Any) -> Path:
    session = tool_context.session
    return session_dir(str(tool_context.user_id or session.user_id), str(session.id))


def touch(path: Path) -> None:
    """Mark a session directory as active so the sweep keeps it."""
    try:
        os.utime(path)
    except OSError:
        pass


def sweep_expired(now: Optional[float] = None) -> int:
    """Delete session directories idle for longer than the TTL."""
    if not ROOT.is_dir():
        return 0
    cutoff = (now if now is not None else time.time()) - TTL_SECONDS
    removed = 0
    for entry in ROOT.iterdir():
        try:
            if entry.is_dir() and not entry.is_symlink() and entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry)
                removed += 1
        except OSError as exc:
            logger.warning("Could not remove expired workspace %s: %s", entry.name, exc)
    if removed:
        logger.info("Removed %d expired builder workspace(s)", removed)
    return removed


def current_project(tool_context: Any) -> tuple[str, Path]:
    """The session's current project name and directory, or WorkspaceError."""
    name = tool_context.state.get(PROJECT_NAME_KEY) or ""
    if not name:
        raise WorkspaceError("No project yet. Call scaffold_agent first.")
    try:
        validate_agent_name(name)
    except ValueError as exc:
        raise WorkspaceError(str(exc)) from exc
    base = session_dir_for(tool_context)
    project = base / name
    if not project.is_dir():
        raise WorkspaceError(
            f"Project '{name}' is no longer on the server (workspaces are cleared "
            "after a while or on redeploy). Scaffold it again and rewrite its files."
        )
    touch(base)
    return name, project


def inside(path: Path, root: Path) -> bool:
    """True when `path` resolves (following any symlink) inside `root`."""
    real_root = os.path.realpath(root)
    real = os.path.realpath(path)
    return real == real_root or real.startswith(real_root + os.sep)


def project_usage(project: Path) -> tuple[int, int]:
    """(file count, total bytes) of a project directory."""
    files = 0
    total = 0
    for dirpath, _dirnames, filenames in os.walk(project):
        for fname in filenames:
            files += 1
            try:
                total += os.path.getsize(os.path.join(dirpath, fname))
            except OSError:
                pass
    return files, total
