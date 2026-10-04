"""Tools that build a complete agent project with nuvel.

scaffold_agent stamps nuvel's production ADK skeleton (FastAPI server, the
17-plugin chain, guardrails, Dockerfile, Railway config, tests) into the
session's workspace. write_file / read_file / list_files edit it,
validate_agent runs nuvel's checks, and package_agent zips the project and
saves it as an artifact the user downloads from the chat.

Tool names match nuvel's meta-agent so nuvel's plugins and path_guard treat
them the same way (cache invalidation, circuit breaker, path correction).
"""

from __future__ import annotations

import io
import logging
import shutil
import zipfile
from pathlib import Path
from typing import Any

from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext
from google.genai import types
from nuvel.backends.adk.scaffold import scaffold_agent as nuvel_scaffold_agent
from nuvel.backends.adk.scaffold import validate_agent_name
from nuvel.tools.file_tools import resolve_safe_path
from nuvel.tools.validate_tool import validate_agent_dir

from .. import workspace
from ..build_summary import OPTION_KEYS, PROJECT_STATE_KEY, project_request
from ..workspace import WorkspaceError

logger = logging.getLogger(__name__)

MAX_READ_CHARS = 60_000
ZIP_MIME_TYPE = "application/zip"


def _error(message: str, **extra: Any) -> dict:
    return {"status": "error", "message": message, **extra}


def scaffold_agent(
    name: str,
    description: str,
    tool_context: ToolContext,
    workflow: bool = False,
    with_composio: bool = False,
    with_slack: bool = False,
    with_telegram: bool = False,
    with_teams: bool = False,
    with_acp: bool = False,
    with_eval: bool = False,
    persona: bool = False,
    replace: bool = False,
) -> dict:
    """Create a new production ADK agent project from nuvel's skeleton.

    Call this once the user has approved the design. It stamps a complete,
    runnable project: FastAPI server with auth and health checks, nuvel's
    17-plugin chain (cost guard, tracing, resilience, guardrails, memory, ...),
    LiteLLM/OpenRouter config, Dockerfile, Railway config, tests, and stub
    prompt/tools/skills files for you to fill in. It becomes the session's
    current project; the file tools then work relative to its root.

    Args:
        name: kebab-case project name, e.g. "support-triage" (lowercase letters,
            digits and single hyphens, max 40 chars). The Python package is the
            snake_case form, e.g. "support_triage".
        description: One-line description of what the agent does.
        workflow: Root agent is an ADK 2.0 Workflow graph instead of one LlmAgent.
            Use for multi-step pipelines with typed handoffs or routing.
        with_composio: Wire the Composio Tool Router (Gmail, GitHub, Slack, Notion,
            Calendar and ~1000 other integrations through one MCP endpoint).
        with_slack: Add a Slack Events API gateway (also enables Composio).
        with_telegram: Add a Telegram bot webhook gateway.
        with_teams: Add a Microsoft Teams bot bridge.
        with_acp: Add an Agent Client Protocol adapter and a terminal CLI.
        with_eval: Add a starter evaluation suite.
        persona: Self-evolving agent with SOUL.md and an awakening flow, for
            long-lived companions only, not task bots.
        replace: Delete and re-create a project with this name from this session.
    """
    try:
        validate_agent_name(name)
    except ValueError as exc:
        return _error(str(exc))

    workspace.sweep_expired()
    base = workspace.session_dir_for(tool_context)
    base.mkdir(parents=True, exist_ok=True)
    workspace.touch(base)

    target = base / name
    if target.exists():
        if not replace:
            return _error(
                f"A project named '{name}' already exists in this session. "
                "Pass replace=True to start it over, or pick another name."
            )
        shutil.rmtree(target)
    else:
        existing = [p for p in base.iterdir() if p.is_dir()]
        if len(existing) >= workspace.MAX_PROJECTS_PER_SESSION:
            return _error(
                f"This session already has {len(existing)} projects, the limit. "
                "Reuse one with replace=True."
            )

    result = nuvel_scaffold_agent(
        name,
        output_dir=str(base),
        description=description,
        persona=persona,
        with_composio=with_composio,
        with_slack=with_slack,
        with_telegram=with_telegram,
        with_teams=with_teams,
        workflow=workflow,
        with_acp=with_acp,
        with_eval=with_eval,
    )
    if result.get("status") != "ok":
        # nuvel's messages can carry the absolute target path.
        return _error(str(result.get("message", "Scaffolding failed.")).replace(str(base), "<workspace>"))

    tool_context.state[workspace.PROJECT_NAME_KEY] = result["agent_name"]
    tool_context.state[workspace.PROJECT_PACKAGE_KEY] = result["package_name"]
    tool_context.state[PROJECT_STATE_KEY] = project_request(
        description,
        {
            "workflow": workflow,
            "with_composio": with_composio,
            "with_slack": with_slack,
            "with_telegram": with_telegram,
            "with_teams": with_teams,
            "with_acp": with_acp,
            "with_eval": with_eval,
            "persona": persona,
        },
    )
    files = workspace.project_files(target)
    return {
        "status": "ok",
        "agent_name": result["agent_name"],
        "package_name": result["package_name"],
        "files_created": len(files),
        "files": files,
        "features": {key: result[key] for key in OPTION_KEYS if result.get(key)},
        "next": (
            "Write the agent's prompt, tools, skills and wiring with write_file, "
            "then call validate_agent and package_agent."
        ),
    }


def write_file(path: str, content: str, tool_context: ToolContext) -> dict:
    """Create or overwrite a text file in the current project.

    Paths are relative to the project root, e.g. "support_triage/tools/lookup.py",
    "support_triage/prompt/instructions.py" or ".env.example". Absolute paths and
    paths leaving the project are rejected. Always write the whole file.

    Args:
        path: File path relative to the project root.
        content: Complete file contents.
    """
    try:
        _name, project = workspace.current_project(tool_context)
        full = Path(resolve_safe_path(path, str(project)))
    except (WorkspaceError, ValueError) as exc:
        return _error(str(exc))

    if full == project or full.is_dir():
        return _error(f"{path} is a directory; give a file path.")
    encoded = content.encode("utf-8")
    if len(encoded) > workspace.MAX_FILE_BYTES:
        return _error(
            f"{path} is {len(encoded)} bytes; the limit per file is "
            f"{workspace.MAX_FILE_BYTES}. Split it into smaller modules."
        )

    files, total = workspace.project_usage(project)
    previous = full.stat().st_size if full.is_file() else 0
    if not full.exists() and files >= workspace.MAX_PROJECT_FILES:
        return _error(f"The project already has {files} files, the limit.")
    if total - previous + len(encoded) > workspace.MAX_PROJECT_BYTES:
        return _error("This write would take the project over its size limit.")

    if not workspace.inside(full, project):
        return _error(f"Path escapes the project: {path}")
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(encoded)
    return {"status": "success", "path": path, "bytes": len(encoded)}


def read_file(path: str, tool_context: ToolContext) -> dict:
    """Read a text file from the current project.

    Args:
        path: File path relative to the project root.
    """
    try:
        _name, project = workspace.current_project(tool_context)
        full = Path(resolve_safe_path(path, str(project)))
    except (WorkspaceError, ValueError) as exc:
        return _error(str(exc))

    if not full.is_file() or not workspace.inside(full, project):
        return _error(f"File not found: {path}")
    try:
        content = full.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return _error(f"{path} is not a UTF-8 text file.")
    truncated = len(content) > MAX_READ_CHARS
    return {
        "status": "success",
        "path": path,
        "content": content[:MAX_READ_CHARS],
        "truncated": truncated,
    }


def list_files(tool_context: ToolContext, path: str = ".") -> dict:
    """List the files and folders in a directory of the current project.

    Args:
        path: Directory relative to the project root; "." for the root.
    """
    try:
        _name, project = workspace.current_project(tool_context)
        full = Path(resolve_safe_path(path, str(project)))
    except (WorkspaceError, ValueError) as exc:
        return _error(str(exc))

    if not full.is_dir() or not workspace.inside(full, project):
        return _error(f"Directory not found: {path}")
    entries = [
        entry.name + "/" if entry.is_dir() else entry.name
        for entry in sorted(full.iterdir())
        if entry.name not in workspace.SKIP_DIRS
    ]
    return {"status": "success", "path": path, "entries": entries, "count": len(entries)}


def _validate(project: Path, name: str) -> dict:
    result = validate_agent_dir(str(project))
    result["agent_dir"] = name  # not the server path
    return result


def validate_agent(tool_context: ToolContext) -> dict:
    """Run nuvel's checks on the current project.

    Checks the required files, that no {{placeholders}} are left, that every
    Python file compiles, and that each skill folder has a SKILL.md. Fix every
    error and validate again before packaging.
    """
    try:
        name, project = workspace.current_project(tool_context)
    except WorkspaceError as exc:
        return _error(str(exc))
    return _validate(project, name)


def _zip_project(project: Path, name: str) -> tuple[bytes, int]:
    buffer = io.BytesIO()
    count = 0
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for rel in workspace.project_files(project):
            archive.write(project / rel, f"{name}/{rel}")
            count += 1
    return buffer.getvalue(), count


async def package_agent(tool_context: ToolContext) -> dict:
    """Validate the current project and save it as a downloadable zip.

    Call this last, once validate_agent passes. The zip appears in the chat as
    "<project>.zip" for the user to download. If validation fails, nothing is
    saved and the errors come back so you can fix them.
    """
    try:
        name, project = workspace.current_project(tool_context)
    except WorkspaceError as exc:
        return _error(str(exc))

    validation = _validate(project, name)
    if validation["status"] != "ok":
        return _error(
            "Validation failed; fix these errors and package again.",
            errors=validation["errors"],
            warnings=validation["warnings"],
        )

    data, count = _zip_project(project, name)
    filename = f"{name}.zip"
    try:
        version = await tool_context.save_artifact(
            filename,
            types.Part(inline_data=types.Blob(mime_type=ZIP_MIME_TYPE, data=data)),
        )
    except Exception as exc:  # artifact service unavailable or misconfigured
        logger.error("Saving %s failed: %s", filename, exc)
        return _error("Could not save the zip. Try package_agent again in a moment.")

    return {
        "status": "success",
        "artifact": filename,
        "version": version,
        "files": count,
        "bytes": len(data),
        "warnings": validation["warnings"],
    }


scaffold_agent_tool = FunctionTool(func=scaffold_agent)
write_file_tool = FunctionTool(func=write_file)
read_file_tool = FunctionTool(func=read_file)
list_files_tool = FunctionTool(func=list_files)
validate_agent_tool = FunctionTool(func=validate_agent)
package_agent_tool = FunctionTool(func=package_agent)
