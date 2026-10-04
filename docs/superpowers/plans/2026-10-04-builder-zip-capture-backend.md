# Builder Zip Capture (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the blueprint from the ADK agent builder and record every build in session state (`builder:project` from `scaffold_agent`, `builder:build` from `package_agent`) so the web app can show a build card and offer "Email me a permanent link".

**Architecture:** The blueprint module, its `after_model_callback` and its prompt section are deleted; the prompt designs in prose and mentions the email link at hand-over. A new focused module, `agents/adk_agent_builder/build_summary.py`, owns the two state keys and reads the project in the session workspace (models from `.env.example` with a `config/llm.py` fallback, tool modules, skill folders). `scaffold_agent` and `package_agent` in `tools/project_tools.py` call it after they succeed.

**Tech Stack:** Python 3.12, Google ADK (`google.adk`), nuvel scaffolder/validator, pytest.

**Spec:** `docs/superpowers/specs/2026-10-04-builder-zip-capture-design.md` (this plan covers the "Backend (agents/adk_agent_builder)" section and the pytest part of "Testing"; a separate plan covers the web app).

## Global Constraints

- The contract with the web app plan is these two session-state shapes, copied verbatim from the spec:

```
builder:project = {"description": str, "options": {<scaffold_agent's option params>: bool}}
```

```
builder:build = {
  "name": "research-summarizer", "package": "research_summarizer",
  "description": "...", "options": {...},            # from builder:project
  "models": {"fast": "openrouter/...", "reasoning": "openrouter/..."},
  "tools": ["web_search", ...],                      # modules in <package>/tools/, minus __init__
  "skills": ["sourced-summary", ...],                # dirs under <package>/skills/ with a SKILL.md
  "artifact": "research-summarizer.zip", "version": 0,
  "files": 41, "bytes": 58213, "packagedAt": "2026-10-04T09:12:00Z"
}
```

- `models` comes from the `FAST_MODEL=` / `REASONING_MODEL=` lines of `.env.example`, falling back to the defaults in `<package>/config/llm.py`. Missing values are `null` (Python `None`).
- Each repackage overwrites `builder:build`. Nothing is written when validation fails (or when the zip is not saved).
- At most 50 tools and 50 skills are kept, with names truncated to 64 chars.
- No blueprint anywhere in the backend: no `blueprint.py`, no `callbacks/blueprint_document.py`, no `after_model_callback=capture_blueprint`, no `BLUEPRINT_INSTRUCTION`, no "Blueprint status" note, no `prompt_v2` (only `tests/test_blueprint.py` used it).
- `list_models` is already committed (`6913001`). Keep `tools/model_tools.py`, `tests/test_builder_models.py`, `tools/__init__.py` and the `list_models` / `config/llm.py` lines in `prompt/prompt.py` as they are.
- Nothing deployment-specific hardcoded (no domains, URLs, senders, ids).
- Test command, from the worktree root: `agents/.venv/bin/python -m pytest tests -q` (94 passing before this plan; 105 after).
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not touch `adk-web-ui/` (separate plan), `.claude/`, or `agents/adk_agent_builder/skills/`.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `agents/adk_agent_builder/blueprint.py` | Delete | (was: blueprint model and fence parsing) |
| `agents/adk_agent_builder/callbacks/` (whole package) | Delete | (was: only `blueprint_document.py` and an empty `__init__.py`) |
| `agents/adk_agent_builder/agent.py` | Modify | Drop the `capture_blueprint` import and `after_model_callback` |
| `agents/adk_agent_builder/prompt/prompt.py` | Modify | Drop `BLUEPRINT_INSTRUCTION`, `prompt_v2`, the blueprint branches of `build_prompt_v3`; prose design summary; email-link line at hand-over |
| `agents/adk_agent_builder/build_summary.py` | Create | State keys, `project_request`, `read_models`, `list_tools`, `list_skills`, `build_summary` |
| `agents/adk_agent_builder/tools/project_tools.py` | Modify | `scaffold_agent` writes `builder:project`; `package_agent` writes `builder:build` |
| `agents/adk_agent_builder/README.md` | Modify | Remove blueprint mentions; document `list_models` and the build records |
| `tests/test_blueprint.py` | Delete | |
| `tests/test_agent_builder.py` | Modify | Drop blueprint prompt tests; add no-blueprint, prompt, scaffold-state and package-state tests |
| `tests/test_build_summary.py` | Create | Unit tests for `build_summary.py` |

---

### Task 1: Remove the blueprint; design in prose and point to the email link

**Files:**
- Delete: `agents/adk_agent_builder/blueprint.py`, `agents/adk_agent_builder/callbacks/` (package), `tests/test_blueprint.py`
- Modify: `agents/adk_agent_builder/agent.py` (imports line 32, `root_agent` line 131)
- Modify: `agents/adk_agent_builder/prompt/prompt.py` (line 6 import, lines 164-197, workflow steps 2 and 4, `build_prompt_v3` at the end)
- Modify: `agents/adk_agent_builder/README.md`
- Test: `tests/test_agent_builder.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `build_prompt_v3(state, sandbox: bool = False, preview: bool = False) -> str` (same signature, no blueprint text). `root_agent.after_model_callback is None`.

- [ ] **Step 1: Replace the blueprint prompt tests with the new tests**

In `tests/test_agent_builder.py`:

Add `import importlib.util` to the imports, so the top reads:

```python
import asyncio
import importlib.util
import io
import os
```

Delete this import line:

```python
from agents.adk_agent_builder.blueprint import BLUEPRINT_STATE_KEY
```

Delete the two tests `test_prompt_offers_the_blueprint_only_before_the_build` and `test_prompt_says_when_a_blueprint_was_already_shown` (the whole block between `test_prompt_names_the_current_project` and the `# ── scaffold_agent ──` comment) and put these two tests in their place:

```python
def test_builder_has_no_blueprint():
    # The zip is the deliverable: no blueprint module, callback or prompt section.
    assert root_agent.after_model_callback is None
    assert importlib.util.find_spec("agents.adk_agent_builder.blueprint") is None
    from agents.adk_agent_builder.prompt import prompt as prompt_module

    assert not hasattr(prompt_module, "prompt_v2")
    assert not hasattr(prompt_module, "BLUEPRINT_INSTRUCTION")
    building = {
        workspace.PROJECT_NAME_KEY: "support-triage",
        workspace.PROJECT_PACKAGE_KEY: "support_triage",
    }
    for state in ({}, building):
        assert "blueprint" not in build_prompt_v3(state, sandbox=True, preview=True).lower()


def test_prompt_designs_in_prose_and_points_to_the_email_link():
    prompt = " ".join(build_prompt_v3({}).split())
    assert "summarise the design in a few lines and ask whether to build it" in prompt
    assert "the user can email themselves a permanent link; mention it in one line." in prompt
    assert "Do not ask for their email in the chat." in prompt
```

Delete the file `tests/test_blueprint.py`:

```bash
git rm -f tests/test_blueprint.py
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_agent_builder.py -q -k "no_blueprint or prose"`
Expected: 2 FAIL — `test_builder_has_no_blueprint` fails on `assert root_agent.after_model_callback is None`, and `test_prompt_designs_in_prose_and_points_to_the_email_link` fails on the "summarise the design" assertion.

- [ ] **Step 3: Delete the blueprint module and callback package**

```bash
git rm -r -f agents/adk_agent_builder/blueprint.py agents/adk_agent_builder/callbacks
rm -rf agents/adk_agent_builder/callbacks   # leftover __pycache__ would make it a namespace package
```

- [ ] **Step 4: Unwire the callback in `agent.py`**

In `agents/adk_agent_builder/agent.py` delete the import line:

```python
from .callbacks.blueprint_document import capture_blueprint
```

and in the `root_agent = Agent(...)` call delete the line:

```python
    after_model_callback=capture_blueprint,
```

so the call ends with:

```python
    tools=_build_tools(),
    before_tool_callback=[path_guard, exfil_guard],
)
```

- [ ] **Step 5: Remove the blueprint from `prompt/prompt.py`**

Delete the import at the top:

```python
from ..blueprint import BLUEPRINT_STATE_KEY
```

Delete the whole `BLUEPRINT_INSTRUCTION = """ ... """` string and the line `prompt_v2 = prompt_v1 + BLUEPRINT_INSTRUCTION` (everything between the end of `prompt_v1` and the comment `# v3: the builder builds.`), leaving two blank lines between `prompt_v1`'s closing `"""` and that comment. Keep `prompt_v0` and `prompt_v1`.

In `PROMPT_V3`, workflow step 2, replace:

```
   budget for planning and hard judgement (REASONING_MODEL). State each choice with
   its price. End with the blueprint (below) and ask whether to build it.
```

with:

```
   budget for planning and hard judgement (REASONING_MODEL). State each choice with
   its price. Then summarise the design in a few lines and ask whether to build it.
```

In `PROMPT_V3`, workflow step 4, replace:

```
4. **Hand over.** In a few lines: what the agent does, what is in the zip, the
   environment variables to set, how to run it locally and deploy it, and good
   next steps. The code is in the zip; do not paste it into the chat.
```

with:

```
4. **Hand over.** In a few lines: what the agent does, what is in the zip, the
   environment variables to set, how to run it locally and deploy it, and good
   next steps. The code is in the zip; do not paste it into the chat. Under the
   zip the user can email themselves a permanent link; mention it in one line.
   Do not ask for their email in the chat.
```

Replace the whole `build_prompt_v3` function at the end of the file with:

```python
def build_prompt_v3(state, sandbox: bool = False, preview: bool = False) -> str:
    """The v3 prompt for one turn: date, workflow, sandbox, preview and the current project."""
    prompt = PROMPT_V3.format(date=get_current_date())
    if sandbox:
        prompt += SANDBOX_INSTRUCTION
    if preview:
        prompt += PREVIEW_INSTRUCTION
    name = state.get("current_agent_name")
    package = state.get("current_agent_package")
    if name and package:
        prompt += (
            "\n# Current project\n"
            f"`{name}` (package `{package}`). The file tools, validate_agent and "
            "package_agent work on this project.\n"
        )
    return prompt
```

Keep the `list_models` sentence in step 2 and the `<package>/config/llm.py` and `.env.example` bullet in "Files to write" exactly as they are.

- [ ] **Step 6: Update the README**

In `agents/adk_agent_builder/README.md`, "How a build goes", replace step 2:

```
2. **Design**: it loads nuvel's architecture and skill-design skills, proposes the agents, tools, skills and nuvel options, and emits a **blueprint** (shown as a panel in the web UI; see `blueprint.py`). It asks before building.
```

with:

```
2. **Design**: it loads nuvel's architecture and skill-design skills, picks models with `list_models`, proposes the agents, tools, skills and nuvel options, then summarises the design in a few lines and asks before building.
```

and replace step 4:

```
4. **Hand over**: a short summary plus `<name>.zip` in the chat.
```

with:

```
4. **Hand over**: a short summary plus `<name>.zip` in the chat. Under the zip, the web app offers to email the user a permanent link.
```

In the "Tools" table, add this row right after the `package_agent` row:

```
| `list_models` | The best (Artificial Analysis agentic/coding/intelligence scores) and most-used current OpenRouter models with tool calling, with prices; falls back to the newest per family without `OPENROUTER_API_KEY` |
```

In "Project structure", replace:

```
├── tools/
│   ├── __init__.py      # get_tools()
│   ├── project_tools.py # scaffold / write / read / list / validate / package
│   └── sandbox_tools.py # run_checks / run_in_sandbox / start_preview / stop_preview
├── blueprint.py         # Blueprint model + ```blueprintjson parsing
├── callbacks/
│   └── blueprint_document.py  # moves the blueprint into session state
├── config/
```

with:

```
├── tools/
│   ├── __init__.py      # get_tools()
│   ├── project_tools.py # scaffold / write / read / list / validate / package
│   ├── model_tools.py   # list_models (OpenRouter benchmarks, usage, catalogue)
│   └── sandbox_tools.py # run_checks / run_in_sandbox / start_preview / stop_preview
├── config/
```

Replace the tests line:

```
Tests: `python -m pytest tests/test_agent_builder.py tests/test_builder_sandbox.py tests/test_builder_preview.py tests/test_blueprint.py`.
```

with:

```
Tests: `python -m pytest tests/test_agent_builder.py tests/test_builder_sandbox.py tests/test_builder_preview.py tests/test_builder_models.py`.
```

- [ ] **Step 7: Run the full suite**

Run: `agents/.venv/bin/python -m pytest tests -q`
Expected: `87 passed` (94 − 7 blueprint tests in `test_blueprint.py` − 2 old prompt tests + 2 new).

Then confirm nothing else references the blueprint:

Run: `grep -rniE "blueprint|prompt_v2" agents/adk_agent_builder tests run_adk.py --include='*.py' --include='*.md' | grep -v "agents/adk_agent_builder/skills/" | grep -v "tests/test_agent_builder.py"`
Expected: no output. (`tests/test_agent_builder.py` is excluded because `test_builder_has_no_blueprint` names the blueprint on purpose; other agents' own `prompt_v2` variables live outside `agents/adk_agent_builder` and are unrelated.)

- [ ] **Step 8: Commit**

```bash
git add agents/adk_agent_builder/agent.py agents/adk_agent_builder/prompt/prompt.py \
  agents/adk_agent_builder/README.md tests/test_agent_builder.py
git commit -m "$(cat <<'EOF'
feat(builder): drop the blueprint

The builder now designs in prose, asks to build, and hands over the zip
with a one-line pointer to the "email me a permanent link" action.
Removes blueprint.py, the capture_blueprint callback, BLUEPRINT_INSTRUCTION
and prompt_v2.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `build_summary.py`: state keys and project readers

**Files:**
- Create: `agents/adk_agent_builder/build_summary.py`
- Test: `tests/test_build_summary.py`

**Interfaces:**
- Consumes: `workspace.inside(path: Path, root: Path) -> bool` from `agents/adk_agent_builder/workspace.py`.
- Produces (all in `agents.adk_agent_builder.build_summary`):
  - `PROJECT_STATE_KEY = "builder:project"`, `BUILD_STATE_KEY = "builder:build"`
  - `OPTION_KEYS: tuple[str, ...] = ("workflow", "with_composio", "with_slack", "with_telegram", "with_teams", "with_acp", "with_eval", "persona")`
  - `MAX_ITEMS = 50`, `MAX_NAME_CHARS = 64`, `MAX_MODEL_CHARS = 200`
  - `project_request(description: str, options: dict[str, Any]) -> dict` → `{"description": str, "options": {key: bool for key in OPTION_KEYS}}`
  - `read_models(project: Path, package: str) -> dict[str, Optional[str]]` → `{"fast": ..., "reasoning": ...}`
  - `list_tools(project: Path, package: str) -> list[str]`
  - `list_skills(project: Path, package: str) -> list[str]`
  - `build_summary(project: Path, name: str, request: Any, *, artifact: str, version: int, files: int, size: int, now: Optional[datetime] = None) -> dict` → the `builder:build` shape from Global Constraints.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_build_summary.py`:

```python
"""builder:project and builder:build: what the builder records about a build."""

import os
from datetime import datetime, timezone

from agents.adk_agent_builder import build_summary as bs
from agents.adk_agent_builder.build_summary import (
    BUILD_STATE_KEY,
    OPTION_KEYS,
    PROJECT_STATE_KEY,
    build_summary,
    list_skills,
    list_tools,
    project_request,
    read_models,
)

LLM_PY = '''import os

FAST_MODEL = LiteLlm(model=os.getenv("FAST_MODEL", "openrouter/acme/fast-default"))
REASONING_MODEL = LiteLlm(
    model=os.getenv(
        "REASONING_MODEL",
        "openrouter/acme/reasoning-default",
    ),
)
'''


def _project(tmp_path, env=None, llm=LLM_PY):
    project = tmp_path / "research-summarizer"
    (project / "research_summarizer" / "config").mkdir(parents=True)
    if env is not None:
        (project / ".env.example").write_text(env)
    if llm is not None:
        (project / "research_summarizer" / "config" / "llm.py").write_text(llm)
    return project


def _touch(path, text=""):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def test_state_keys_match_the_web_app_contract():
    assert PROJECT_STATE_KEY == "builder:project"
    assert BUILD_STATE_KEY == "builder:build"


def test_project_request_lists_every_option_as_a_bool():
    request = project_request("Summarises sources", {"workflow": True, "with_acp": 1})
    assert request["description"] == "Summarises sources"
    assert list(request["options"]) == list(OPTION_KEYS)
    assert request["options"]["workflow"] is True
    assert request["options"]["with_acp"] is True
    assert request["options"]["persona"] is False


def test_models_prefer_an_active_env_line_over_a_commented_one(tmp_path):
    project = _project(tmp_path, env=(
        "# FAST_MODEL=openrouter/acme/commented\n"
        'FAST_MODEL="openrouter/acme/fast"  # cheap\n'
        "# REASONING_MODEL=openrouter/acme/reasoning\n"
        "# NUVEL_SKILL_CURATOR_MODEL=gemini-2.0-flash\n"
    ))
    assert read_models(project, "research_summarizer") == {
        "fast": "openrouter/acme/fast",
        "reasoning": "openrouter/acme/reasoning",
    }


def test_models_fall_back_to_the_llm_py_defaults(tmp_path):
    project = _project(tmp_path, env="OPENROUTER_API_KEY=x\nREASONING_MODEL=\n")
    assert read_models(project, "research_summarizer") == {
        "fast": "openrouter/acme/fast-default",
        "reasoning": "openrouter/acme/reasoning-default",
    }


def test_models_skip_unfilled_template_placeholders(tmp_path):
    project = _project(tmp_path, env="# FAST_MODEL={{default_fast_model}}\n")
    assert read_models(project, "research_summarizer")["fast"] == "openrouter/acme/fast-default"


def test_missing_models_are_none(tmp_path):
    project = _project(tmp_path, env=None, llm=None)
    assert read_models(project, "research_summarizer") == {"fast": None, "reasoning": None}


def test_tools_are_the_builders_modules_only(tmp_path):
    project = _project(tmp_path)
    tools = project / "research_summarizer" / "tools"
    for name in ("__init__.py", "web_search.py", "halt_tools.py", "notes.txt"):
        _touch(tools / name)
    _touch(tools / "helpers" / "x.py")
    # halt_tools ships with nuvel's skeleton in every project: not the builder's work.
    assert list_tools(project, "research_summarizer") == ["web_search"]


def test_skills_need_a_skill_md(tmp_path):
    project = _project(tmp_path)
    skills = project / "research_summarizer" / "skills"
    _touch(skills / "sourced-summary" / "SKILL.md", "---\nname: sourced-summary\n---\n")
    (skills / "half-written").mkdir()
    assert list_skills(project, "research_summarizer") == ["sourced-summary"]


def test_missing_folders_give_empty_lists(tmp_path):
    project = _project(tmp_path)
    assert list_tools(project, "research_summarizer") == []
    assert list_skills(project, "research_summarizer") == []


def test_symlinks_out_of_the_project_are_ignored(tmp_path):
    project = _project(tmp_path)
    outside = tmp_path / "outside"
    _touch(outside / "secret.py")
    _touch(outside / "skill" / "SKILL.md")
    tools = project / "research_summarizer" / "tools"
    tools.mkdir()
    os.symlink(outside / "secret.py", tools / "secret.py")
    os.symlink(outside, project / "research_summarizer" / "skills")
    os.symlink(outside / "secret.py", project / ".env.example")
    assert list_tools(project, "research_summarizer") == []
    assert list_skills(project, "research_summarizer") == []
    assert read_models(project, "research_summarizer")["fast"] == "openrouter/acme/fast-default"


def test_lists_are_capped_and_names_truncated(tmp_path, monkeypatch):
    monkeypatch.setattr(bs, "MAX_ITEMS", 3)
    project = _project(tmp_path)
    tools = project / "research_summarizer" / "tools"
    for i in range(5):
        _touch(tools / f"tool_{i}.py")
    _touch(tools / ("a" * 100 + ".py"))
    assert list_tools(project, "research_summarizer") == ["a" * 64, "tool_0", "tool_1"]


def test_the_real_caps_are_50_items_and_64_chars():
    assert bs.MAX_ITEMS == 50
    assert bs.MAX_NAME_CHARS == 64


def test_build_summary_shape(tmp_path):
    project = _project(tmp_path, env="FAST_MODEL=openrouter/acme/fast\n")
    _touch(project / "research_summarizer" / "tools" / "web_search.py")
    _touch(project / "research_summarizer" / "skills" / "sourced-summary" / "SKILL.md")
    request = project_request("Summarises sources", {"workflow": True})
    summary = build_summary(
        project, "research-summarizer", request,
        artifact="research-summarizer.zip", version=2, files=41, size=58213,
        now=datetime(2026, 10, 4, 9, 12, 0, 500, tzinfo=timezone.utc),
    )
    assert summary == {
        "name": "research-summarizer",
        "package": "research_summarizer",
        "description": "Summarises sources",
        "options": request["options"],
        "models": {"fast": "openrouter/acme/fast", "reasoning": "openrouter/acme/reasoning-default"},
        "tools": ["web_search"],
        "skills": ["sourced-summary"],
        "artifact": "research-summarizer.zip",
        "version": 2,
        "files": 41,
        "bytes": 58213,
        "packagedAt": "2026-10-04T09:12:00Z",
    }


def test_build_summary_tolerates_a_missing_or_odd_request(tmp_path):
    project = _project(tmp_path)
    for request in (None, "nope", {"description": 3, "options": ["workflow"]}):
        summary = build_summary(
            project, "research-summarizer", request,
            artifact="research-summarizer.zip", version=0, files=1, size=1,
        )
        assert summary["description"] == ""
        assert summary["options"] == {}
        assert summary["packagedAt"].endswith("Z")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_build_summary.py -q`
Expected: collection ERROR, `ModuleNotFoundError: No module named 'agents.adk_agent_builder.build_summary'`.

- [ ] **Step 3: Write the module**

Create `agents/adk_agent_builder/build_summary.py`:

```python
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
```

Notes for the implementer:
- nuvel's `.env.example` ships the models commented out (`# FAST_MODEL=openrouter/...`), and `config/llm.py` uses `os.getenv("FAST_MODEL", "openrouter/...")`. Both forms are handled; a value still holding `{{...}}` is ignored.
- The `_GETENV_DEFAULT` regex allows a trailing comma because a reformatted `llm.py` often splits the call over several lines (the test's `REASONING_MODEL` case).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_build_summary.py -q`
Expected: `14 passed`.

- [ ] **Step 5: Commit**

```bash
git add agents/adk_agent_builder/build_summary.py tests/test_build_summary.py
git commit -m "$(cat <<'EOF'
feat(builder): build summary readers for builder:project and builder:build

Reads the models from .env.example (falling back to config/llm.py), the
tool modules and the skill folders of a generated project, capped at 50
names of 64 chars, ignoring symlinks out of the project.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `scaffold_agent` stores `builder:project`

**Files:**
- Modify: `agents/adk_agent_builder/tools/project_tools.py` (imports near line 30; `scaffold_agent` state writes at lines 127-128 and the `features` dict at lines 136-143)
- Test: `tests/test_agent_builder.py`

**Interfaces:**
- Consumes: `PROJECT_STATE_KEY`, `OPTION_KEYS`, `project_request(description, options) -> dict` from Task 2.
- Produces: after a successful `scaffold_agent`, `tool_context.state["builder:project"] == {"description": <description>, "options": {<8 OPTION_KEYS>: bool}}`. Nothing is written on failure. Task 4 reads this value.

- [ ] **Step 1: Write the failing tests**

In `tests/test_agent_builder.py`, add this import after the `agents.adk_agent_builder.agent` import:

```python
from agents.adk_agent_builder.build_summary import BUILD_STATE_KEY, PROJECT_STATE_KEY
```

Replace `test_scaffold_rejects_bad_names` with:

```python
def test_scaffold_rejects_bad_names():
    ctx = FakeToolContext()
    result = _scaffold(ctx, name="../escape")
    assert result["status"] == "error"
    assert PROJECT_STATE_KEY not in ctx.state


def test_scaffold_stores_what_it_was_asked_for():
    ctx = FakeToolContext()
    assert _scaffold(ctx, workflow=True, with_slack=True)["status"] == "ok"
    assert ctx.state[PROJECT_STATE_KEY] == {
        "description": "Triages support email",
        "options": {
            "workflow": True, "with_composio": False, "with_slack": True,
            "with_telegram": False, "with_teams": False, "with_acp": False,
            "with_eval": False, "persona": False,
        },
    }
```

(`BUILD_STATE_KEY` is imported now and used in Task 4.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `agents/.venv/bin/python -m pytest tests/test_agent_builder.py -q -k scaffold_stores`
Expected: FAIL with `KeyError: 'builder:project'`.

- [ ] **Step 3: Write the state in `scaffold_agent`**

In `agents/adk_agent_builder/tools/project_tools.py`, after the `workspace` imports, add:

```python
from ..build_summary import OPTION_KEYS, PROJECT_STATE_KEY, project_request
```

so the block reads:

```python
from .. import workspace
from ..build_summary import OPTION_KEYS, PROJECT_STATE_KEY, project_request
from ..workspace import WorkspaceError
```

In `scaffold_agent`, after:

```python
    tool_context.state[workspace.PROJECT_PACKAGE_KEY] = result["package_name"]
```

add:

```python
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
```

and replace the `features` entry of the returned dict:

```python
        "features": {
            key: result[key]
            for key in (
                "workflow", "with_composio", "with_slack", "with_telegram",
                "with_teams", "with_acp", "with_eval", "persona",
            )
            if result.get(key)
        },
```

with:

```python
        "features": {key: result[key] for key in OPTION_KEYS if result.get(key)},
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_agent_builder.py -q`
Expected: all pass (including `test_scaffold_passes_nuvel_options`, which checks `features` is unchanged).

- [ ] **Step 5: Commit**

```bash
git add agents/adk_agent_builder/tools/project_tools.py tests/test_agent_builder.py
git commit -m "$(cat <<'EOF'
feat(builder): scaffold_agent records builder:project

Stores the description and the nuvel options it was asked for, so the
build summary can report them.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `package_agent` writes `builder:build`

**Files:**
- Modify: `agents/adk_agent_builder/tools/project_tools.py` (module docstring lines 1-11, the `build_summary` import, `package_agent` after the `save_artifact` try/except near line 299)
- Modify: `agents/adk_agent_builder/README.md`
- Test: `tests/test_agent_builder.py` (`FakeToolContext`, package tests, end-to-end test)

**Interfaces:**
- Consumes: `BUILD_STATE_KEY`, `PROJECT_STATE_KEY`, `build_summary(project, name, request, *, artifact, version, files, size)` from Task 2; `builder:project` written by Task 3.
- Produces: after a saved zip, `tool_context.state["builder:build"]` holds the shape in Global Constraints (the web app plan's `parseBuild` input). The tool's return value is unchanged.

- [ ] **Step 1: Write the failing tests**

In `tests/test_agent_builder.py`, make `FakeToolContext` number artifact versions like ADK does (replace its `__init__` tail and `save_artifact`):

```python
class FakeToolContext:
    def __init__(self, session_id="s1", user_id="u1", state=None):
        self.state = state if state is not None else {}
        self.user_id = user_id
        self.session = SimpleNamespace(id=session_id, user_id=user_id)
        self.artifacts = {}
        self.versions = {}

    async def save_artifact(self, filename, artifact, custom_metadata=None):
        self.artifacts[filename] = artifact
        self.versions[filename] = self.versions.get(filename, -1) + 1
        return self.versions[filename]
```

Add one line at the end of `test_package_refuses_an_invalid_project`:

```python
    assert BUILD_STATE_KEY not in ctx.state
```

Add these tests right after `test_package_refuses_an_invalid_project`:

```python
def test_package_records_the_build():
    ctx = FakeToolContext()
    _scaffold(ctx, with_acp=True)
    write_file(".env.example", "OPENROUTER_API_KEY=\nFAST_MODEL=openrouter/acme/fast\n", ctx)
    write_file(
        "support_triage/config/llm.py",
        'import os\n\nREASONING = os.getenv("REASONING_MODEL", "openrouter/acme/reasoning")\n',
        ctx,
    )
    write_file("support_triage/tools/lookup.py", '"""Lookup."""\n', ctx)
    write_file("support_triage/skills/triage-rules/SKILL.md", "---\nname: triage-rules\n---\n", ctx)
    result = asyncio.run(package_agent(ctx))
    assert result["status"] == "success", result

    build = ctx.state[BUILD_STATE_KEY]
    assert build["name"] == "support-triage"
    assert build["package"] == "support_triage"
    assert build["description"] == "Triages support email"
    assert build["options"]["with_acp"] is True
    assert build["models"] == {"fast": "openrouter/acme/fast", "reasoning": "openrouter/acme/reasoning"}
    assert "lookup" in build["tools"] and "__init__" not in build["tools"]
    assert build["skills"] == ["triage-rules"]
    assert build["artifact"] == "support-triage.zip"
    assert build["version"] == result["version"] == 0
    assert build["files"] == result["files"]
    assert build["bytes"] == result["bytes"]
    assert build["packagedAt"].endswith("Z")
    assert str(workspace.ROOT) not in repr(build)


def test_repackaging_overwrites_the_build():
    ctx = FakeToolContext()
    _scaffold(ctx)
    asyncio.run(package_agent(ctx))
    assert "lookup" not in ctx.state[BUILD_STATE_KEY]["tools"]
    write_file("support_triage/tools/lookup.py", '"""Lookup."""\n', ctx)
    result = asyncio.run(package_agent(ctx))
    assert ctx.state[BUILD_STATE_KEY]["version"] == result["version"] == 1
    assert "lookup" in ctx.state[BUILD_STATE_KEY]["tools"]


def test_package_records_nothing_when_the_zip_is_not_saved():
    class FailingContext(FakeToolContext):
        async def save_artifact(self, filename, artifact, custom_metadata=None):
            raise RuntimeError("artifact service down")

    ctx = FailingContext()
    _scaffold(ctx)
    assert asyncio.run(package_agent(ctx))["status"] == "error"
    assert BUILD_STATE_KEY not in ctx.state
```

In `test_build_runs_end_to_end_with_the_nuvel_chain`, after:

```python
    assert session.state[workspace.PROJECT_NAME_KEY] == "support-triage"
```

add:

```python
    assert session.state[PROJECT_STATE_KEY]["description"] == "Triage email"
    assert session.state[BUILD_STATE_KEY]["artifact"] == "support-triage.zip"
    assert session.state[BUILD_STATE_KEY]["version"] == responses["package_agent"]["version"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_agent_builder.py -q -k "records or repackaging or end_to_end"`
Expected: `test_package_records_the_build`, `test_repackaging_overwrites_the_build` and `test_build_runs_end_to_end_with_the_nuvel_chain` FAIL with `KeyError: 'builder:build'`; `test_package_records_nothing_when_the_zip_is_not_saved` passes already (it guards the behaviour you are about to add).

- [ ] **Step 3: Write the summary in `package_agent`**

In `agents/adk_agent_builder/tools/project_tools.py`, widen the Task 3 import to:

```python
from ..build_summary import (
    BUILD_STATE_KEY,
    OPTION_KEYS,
    PROJECT_STATE_KEY,
    build_summary,
    project_request,
)
```

In `package_agent`, right after the `save_artifact` try/except:

```python
    except Exception as exc:  # artifact service unavailable or misconfigured
        logger.error("Saving %s failed: %s", filename, exc)
        return _error("Could not save the zip. Try package_agent again in a moment.")
```

add:

```python

    try:
        # Each package overwrites the last summary; the web app shows it as the build card.
        tool_context.state[BUILD_STATE_KEY] = build_summary(
            project,
            name,
            tool_context.state.get(PROJECT_STATE_KEY),
            artifact=filename,
            version=version,
            files=count,
            size=len(data),
        )
    except Exception as exc:  # the zip is saved; never fail the hand-over over its summary
        logger.error("Recording the build summary for %s failed: %s", filename, exc)
```

Leave the returned dict unchanged.

In the module docstring, replace:

```
validate_agent runs nuvel's checks, and package_agent zips the project and
saves it as an artifact the user downloads from the chat.
```

with:

```
validate_agent runs nuvel's checks, and package_agent zips the project,
saves it as an artifact the user downloads from the chat, and records a
build summary in session state (see build_summary.py).
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_agent_builder.py -q`
Expected: all pass.

- [ ] **Step 5: Document the build records in the README**

In `agents/adk_agent_builder/README.md`, add this section right before `## The workspace`:

```
## Build records

Every build is recorded in session state, without personal data (`build_summary.py`):

- `scaffold_agent` stores `builder:project`: the description and the nuvel options it was asked for.
- `package_agent`, once the zip is saved, stores `builder:build`: name, package, description, options, models (from `.env.example`, falling back to `<package>/config/llm.py`), tools and skills (at most 50 each, names cut to 64 characters), the artifact name and version, file count, bytes and `packagedAt`. Each package overwrites it; nothing is written when validation fails.

The web app reads `builder:build` from the stream to show the build card, and the ops analytics read it from the `sessions` table.
```

In "Project structure", after the `preview_api.py` line add:

```
├── build_summary.py     # builder:project / builder:build session state
```

Replace the tests line with:

```
Tests: `python -m pytest tests/test_agent_builder.py tests/test_build_summary.py tests/test_builder_sandbox.py tests/test_builder_preview.py tests/test_builder_models.py`.
```

- [ ] **Step 6: Run the full suite**

Run: `agents/.venv/bin/python -m pytest tests -q`
Expected: `105 passed` (87 after Task 1 + 14 in `test_build_summary.py` + 1 scaffold test + 3 package tests).

- [ ] **Step 7: Commit**

```bash
git add agents/adk_agent_builder/tools/project_tools.py agents/adk_agent_builder/README.md tests/test_agent_builder.py
git commit -m "$(cat <<'EOF'
feat(builder): package_agent records builder:build

After the zip is saved, package_agent writes a build summary (models,
tools, skills, artifact name and version, size) to session state. ADK
keeps it in the sessions table, so every build is recorded anonymously;
the web app shows it as the build card.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- Spec coverage (backend): remove blueprint.py, callback, wiring, `BLUEPRINT_INSTRUCTION`, "Blueprint status", `prompt_v2`, `tests/test_blueprint.py`, blueprint prompt tests → Task 1. Prompt step 2 and hand-over lines → Task 1. `builder:project` → Task 3. `builder:build`, models with fallback, nulls, overwrite, caps → Tasks 2 and 4. README blueprint mentions → Tasks 1 and 4.
- Spec coverage (pytest): scaffold stores `builder:project` → Task 3; `builder:build` with `.env.example` models and `llm.py` fallback, tools and skills, caps, nothing written on failed validation → Tasks 2 and 4; no blueprint callback and no `blueprintjson` in the prompt → Task 1.
- Out of this plan: everything under `adk-web-ui/` (`parseBuild`, BuildCard, `/api/builds`, `build_saves`, analytics, copy).
