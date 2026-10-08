"""What the builder records about each build, in session state.

scaffold_agent stores what it was asked for under PROJECT_STATE_KEY, and
package_agent stores a summary of every zip it saves under BUILD_STATE_KEY.
ADK keeps both with the session, so every build is recorded without personal
data. The web app reads `builder:build` from the stream to show the build
card; field names are camelCase on the wire.

Everything here reads the project from the session's workspace and never
raises on a missing or odd file: a summary field is just empty.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from nuvel.backends.adk.scaffold import TEMPLATES_DIR as NUVEL_TEMPLATES_DIR

from . import workspace

PROJECT_STATE_KEY = "builder:project"
BUILD_STATE_KEY = "builder:build"

# scaffold_agent's nuvel option parameters (not `replace`), in signature order.
OPTION_KEYS = (
    "workflow", "with_composio", "with_slack", "with_telegram",
    "with_teams", "with_acp", "with_eval", "persona",
)

MAX_ITEMS = 50
MAX_NAME_CHARS = 64
MAX_MODEL_CHARS = 200
MAX_READ_BYTES = 256 * 1024

MODEL_VARS = {"fast": "FAST_MODEL", "reasoning": "REASONING_MODEL"}

# `FAST_MODEL=x` or the template's commented `# FAST_MODEL=x` in .env.example.
_ENV_LINE = re.compile(
    r"^[ \t]*(#)?[ \t]*(FAST_MODEL|REASONING_MODEL)[ \t]*=[ \t]*(\S+)", re.MULTILINE
)
# `os.getenv("FAST_MODEL", "x")` in <package>/config/llm.py, one line or several.
_GETENV_DEFAULT = re.compile(
    r"""os\.(?:getenv|environ\.get)\(\s*["'](FAST_MODEL|REASONING_MODEL)["']\s*,\s*["']([^"'\n]+)["']\s*,?\s*\)"""
)


def project_request(description: str, options: dict[str, Any]) -> dict:
    """The `builder:project` value: what scaffold_agent was asked for."""
    return {
        "description": description,
        "options": {key: bool(options.get(key)) for key in OPTION_KEYS},
    }


def _read_text(path: Path, project: Path) -> str:
    """A project file's text, or "" when it is missing, a symlink or outside the project."""
    try:
        if path.is_symlink() or not path.is_file() or not workspace.inside(path, project):
            return ""
        with path.open("rb") as handle:
            return handle.read(MAX_READ_BYTES).decode("utf-8", errors="replace")
    except OSError:
        return ""


def _clean_model(raw: str) -> Optional[str]:
    value = raw.split("#", 1)[0].strip().strip("'\"").strip()
    if not value or "{{" in value:  # empty, or an unfilled template placeholder
        return None
    return value[:MAX_MODEL_CHARS]


def _env_models(text: str) -> dict[str, str]:
    """Model ids from .env.example; an active line beats a commented one."""
    active: dict[str, str] = {}
    commented: dict[str, str] = {}
    for match in _ENV_LINE.finditer(text):
        value = _clean_model(match.group(3))
        if value is None:
            continue
        target = commented if match.group(1) else active
        target.setdefault(match.group(2), value)
    return {**commented, **active}


def _default_models(text: str) -> dict[str, str]:
    """Model ids from the os.getenv defaults in config/llm.py."""
    found: dict[str, str] = {}
    for match in _GETENV_DEFAULT.finditer(text):
        value = _clean_model(match.group(2))
        if value is not None:
            found.setdefault(match.group(1), value)
    return found


def read_models(project: Path, package: str) -> dict[str, Optional[str]]:
    """{"fast": id|None, "reasoning": id|None}: .env.example first, then config/llm.py."""
    env = _env_models(_read_text(project / ".env.example", project))
    defaults = _default_models(_read_text(project / package / "config" / "llm.py", project))
    return {key: env.get(var) or defaults.get(var) for key, var in MODEL_VARS.items()}


def _capped(names: list[str]) -> list[str]:
    return [name[:MAX_NAME_CHARS] for name in sorted(names)[:MAX_ITEMS]]


def _subdir(project: Path, *parts: str) -> Optional[Path]:
    path = project.joinpath(*parts)
    if path.is_symlink() or not path.is_dir() or not workspace.inside(path, project):
        return None
    return path


# Tool modules nuvel's skeleton (and its overlays) put in every project, read
# from the installed templates so this follows nuvel without a hardcoded list.
SKELETON_TOOLS = frozenset(
    path.stem
    for path in NUVEL_TEMPLATES_DIR.parent.glob("templates*/**/tools/*.py")
)


def list_tools(project: Path, package: str) -> list[str]:
    """Tool modules the builder added in <package>/tools/ (not __init__ or nuvel's own)."""
    tools_dir = _subdir(project, package, "tools")
    if tools_dir is None:
        return []
    return _capped([
        entry.stem
        for entry in tools_dir.iterdir()
        if entry.suffix == ".py" and entry.name != "__init__.py"
        and entry.stem not in SKELETON_TOOLS
        and entry.is_file() and not entry.is_symlink()
    ])


def list_skills(project: Path, package: str) -> list[str]:
    """Skill folders under <package>/skills/ that have a SKILL.md."""
    skills_dir = _subdir(project, package, "skills")
    if skills_dir is None:
        return []
    return _capped([
        entry.name
        for entry in skills_dir.iterdir()
        if entry.is_dir() and not entry.is_symlink()
        and (entry / "SKILL.md").is_file() and not (entry / "SKILL.md").is_symlink()
    ])


def build_summary(
    project: Path,
    name: str,
    request: Any,
    *,
    artifact: str,
    version: int,
    files: int,
    size: int,
    now: Optional[datetime] = None,
) -> dict:
    """The `builder:build` value for a zip package_agent just saved.

    `request` is the session's `builder:project` value (anything else counts as
    missing). The package is derived from the validated project name, as nuvel
    does, never read from state.
    """
    package = name.replace("-", "_")
    request = request if isinstance(request, dict) else {}
    description = request.get("description")
    options = request.get("options")
    packaged_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return {
        "name": name,
        "package": package,
        "description": description if isinstance(description, str) else "",
        "options": (
            {key: bool(options.get(key)) for key in OPTION_KEYS} if isinstance(options, dict) else {}
        ),
        "models": read_models(project, package),
        "tools": list_tools(project, package),
        "skills": list_skills(project, package),
        "artifact": artifact,
        "version": version,
        "files": files,
        "bytes": size,
        "packagedAt": packaged_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
