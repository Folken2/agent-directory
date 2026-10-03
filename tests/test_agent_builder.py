"""The agent builder: nuvel wiring, the session workspace, and its tools."""

import asyncio
import io
import os
import time
import zipfile
from types import SimpleNamespace
from typing import AsyncGenerator

import pytest
from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import InMemoryRunner
from google.genai import types

from agents.adk_agent_builder import workspace
from agents.adk_agent_builder.agent import NUVEL_SKILLS_DIR, app, root_agent
from agents.adk_agent_builder.nuvel_plugins import builder_plugins
from agents.adk_agent_builder.prompt.prompt import build_prompt_v3
from agents.adk_agent_builder.tools import get_tools
from agents.adk_agent_builder.tools.project_tools import (
    list_files,
    package_agent,
    read_file,
    scaffold_agent,
    validate_agent,
    write_file,
)


@pytest.fixture(autouse=True)
def workspace_root(tmp_path, monkeypatch):
    root = tmp_path / "workspaces"
    monkeypatch.setattr(workspace, "ROOT", root)
    return root


class FakeToolContext:
    def __init__(self, session_id="s1", user_id="u1", state=None):
        self.state = state if state is not None else {}
        self.user_id = user_id
        self.session = SimpleNamespace(id=session_id, user_id=user_id)
        self.artifacts = {}

    async def save_artifact(self, filename, artifact, custom_metadata=None):
        self.artifacts[filename] = artifact
        return 0


def _scaffold(ctx, name="support-triage", **flags):
    return scaffold_agent(name=name, description="Triages support email", tool_context=ctx, **flags)


# ── nuvel wiring ──────────────────────────────────────────────────────


def test_app_carries_nuvel_plugins_for_the_builder_only():
    assert isinstance(app, App)
    assert app.name == "adk_agent_builder"
    assert app.root_agent is root_agent
    assert [p.name for p in app.plugins] == [
        "cost_guard", "context_window", "resilience", "guardrails", "cache",
    ]


def test_builder_loads_every_nuvel_adk_skill():
    skill_dirs = [d for d in NUVEL_SKILLS_DIR.iterdir() if (d / "SKILL.md").is_file()]
    assert len(skill_dirs) >= 15
    toolsets = [t for t in root_agent.tools if type(t).__name__ == "SkillToolset"]
    assert len(toolsets) == 1


def test_builder_exposes_the_project_tools_and_nuvel_guards():
    names = {t.name for t in get_tools()}
    assert {"scaffold_agent", "write_file", "read_file", "list_files",
            "validate_agent", "package_agent"} <= names
    guards = {cb.__name__ for cb in root_agent.before_tool_callback}
    assert guards == {"path_guard", "exfil_guard"}


def test_cost_guard_has_a_session_budget_by_default():
    cost_guard = builder_plugins()[0]
    assert cost_guard._budget > 0


def test_prompt_names_the_current_project():
    assert "# Current project" not in build_prompt_v3({})
    prompt = build_prompt_v3({
        workspace.PROJECT_NAME_KEY: "support-triage",
        workspace.PROJECT_PACKAGE_KEY: "support_triage",
    })
    assert "`support-triage` (package `support_triage`)" in prompt
    assert "```blueprintjson" in prompt


# ── scaffold_agent ────────────────────────────────────────────────────


def test_scaffold_creates_a_project_in_the_session_workspace(workspace_root):
    ctx = FakeToolContext()
    result = _scaffold(ctx)
    assert result["status"] == "ok", result
    assert result["package_name"] == "support_triage"
    assert ctx.state[workspace.PROJECT_NAME_KEY] == "support-triage"
    assert ctx.state[workspace.PROJECT_PACKAGE_KEY] == "support_triage"
    assert "run_adk.py" in result["files"]
    assert "support_triage/plugins/cost_guard_plugin.py" in result["files"]
    # No server paths reach the model or the client.
    assert str(workspace_root) not in repr(result)
    assert str(workspace_root) not in repr(ctx.state)
    project = workspace.session_dir("u1", "s1") / "support-triage"
    assert (project / "support_triage" / "agent.py").is_file()


def test_scaffold_rejects_bad_names():
    result = _scaffold(FakeToolContext(), name="../escape")
    assert result["status"] == "error"


def test_scaffold_twice_needs_replace():
    ctx = FakeToolContext()
    assert _scaffold(ctx)["status"] == "ok"
    assert _scaffold(ctx)["status"] == "error"
    assert _scaffold(ctx, replace=True)["status"] == "ok"


def test_scaffold_caps_projects_per_session(monkeypatch):
    monkeypatch.setattr(workspace, "MAX_PROJECTS_PER_SESSION", 2)
    ctx = FakeToolContext()
    assert _scaffold(ctx, name="one")["status"] == "ok"
    assert _scaffold(ctx, name="two")["status"] == "ok"
    assert _scaffold(ctx, name="three")["status"] == "error"


def test_scaffold_passes_nuvel_options():
    ctx = FakeToolContext()
    result = _scaffold(ctx, with_acp=True, workflow=True)
    assert result["status"] == "ok", result
    assert result["features"] == {"workflow": True, "with_acp": True}
    assert "support_triage/agent_workflow.py" in result["files"]


# ── sessions are isolated ─────────────────────────────────────────────


def test_sessions_get_separate_workspaces():
    a, b = FakeToolContext(session_id="a"), FakeToolContext(session_id="b")
    _scaffold(a)
    _scaffold(b)
    write_file("notes.md", "from a", a)
    assert read_file("notes.md", b)["status"] == "error"
    assert read_file("notes.md", a)["content"] == "from a"


def test_state_cannot_point_tools_elsewhere():
    ctx = FakeToolContext()
    _scaffold(ctx)
    ctx.state[workspace.PROJECT_NAME_KEY] = "../../etc"
    assert write_file("x.py", "x = 1", ctx)["status"] == "error"
    other = FakeToolContext(session_id="other")
    _scaffold(other)
    # Naming another session's project only resolves inside this session.
    ctx.state[workspace.PROJECT_NAME_KEY] = "missing-project"
    assert read_file("run_adk.py", ctx)["status"] == "error"


def test_tools_need_a_project_first():
    ctx = FakeToolContext()
    assert write_file("a.py", "a = 1", ctx)["status"] == "error"
    assert validate_agent(ctx)["status"] == "error"


# ── file tools ────────────────────────────────────────────────────────


def test_write_read_and_list():
    ctx = FakeToolContext()
    _scaffold(ctx)
    content = '"""Lookup."""\n\n\ndef lookup(q: str) -> dict:\n    return {"status": "success"}\n'
    assert write_file("support_triage/tools/lookup.py", content, ctx)["status"] == "success"
    assert read_file("support_triage/tools/lookup.py", ctx)["content"] == content
    listing = list_files(ctx, "support_triage/tools")
    assert "lookup.py" in listing["entries"]


def test_write_rejects_paths_outside_the_project():
    ctx = FakeToolContext()
    _scaffold(ctx)
    assert write_file("/etc/passwd", "x", ctx)["status"] == "error"
    assert write_file("../other/x.py", "x", ctx)["status"] == "error"
    assert write_file(".", "x", ctx)["status"] == "error"


def test_write_rejects_symlink_escape(tmp_path):
    ctx = FakeToolContext()
    _scaffold(ctx)
    project = workspace.session_dir("u1", "s1") / "support-triage"
    os.symlink(tmp_path, project / "link")
    assert write_file("link/evil.py", "x", ctx)["status"] == "error"
    assert not (tmp_path / "evil.py").exists()


def test_write_enforces_size_limits(monkeypatch):
    ctx = FakeToolContext()
    _scaffold(ctx)
    monkeypatch.setattr(workspace, "MAX_FILE_BYTES", 10)
    assert write_file("big.txt", "x" * 11, ctx)["status"] == "error"
    monkeypatch.setattr(workspace, "MAX_FILE_BYTES", 10_000)
    monkeypatch.setattr(workspace, "MAX_PROJECT_BYTES", 1)
    assert write_file("small.txt", "x", ctx)["status"] == "error"


def test_read_truncates_long_files(monkeypatch):
    from agents.adk_agent_builder.tools import project_tools

    ctx = FakeToolContext()
    _scaffold(ctx)
    monkeypatch.setattr(project_tools, "MAX_READ_CHARS", 5)
    write_file("long.txt", "abcdefghij", ctx)
    result = read_file("long.txt", ctx)
    assert result["content"] == "abcde"
    assert result["truncated"] is True


# ── validate and package ──────────────────────────────────────────────


def test_fresh_scaffold_validates():
    ctx = FakeToolContext()
    _scaffold(ctx)
    result = validate_agent(ctx)
    assert result["status"] == "ok", result["errors"]
    assert result["agent_dir"] == "support-triage"


def test_validate_reports_syntax_errors():
    ctx = FakeToolContext()
    _scaffold(ctx)
    write_file("support_triage/tools/broken.py", "def broken(:\n", ctx)
    result = validate_agent(ctx)
    assert result["status"] == "error"
    assert any("support_triage/tools/broken.py" in e for e in result["errors"])


def test_package_saves_a_zip_artifact():
    ctx = FakeToolContext()
    _scaffold(ctx)
    write_file(".env", "OPENROUTER_API_KEY=real-key", ctx)
    write_file("support_triage/__pycache__/x.cpython-311.pyc", "cache", ctx)
    result = asyncio.run(package_agent(ctx))
    assert result["status"] == "success", result
    assert result["artifact"] == "support-triage.zip"

    part = ctx.artifacts["support-triage.zip"]
    assert part.inline_data.mime_type == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(part.inline_data.data)).namelist()
    assert len(names) == result["files"]
    assert "support-triage/run_adk.py" in names
    assert "support-triage/support_triage/agent.py" in names
    assert "support-triage/.env.example" in names
    assert "support-triage/.env" not in names
    assert not any("__pycache__" in n for n in names)


def test_package_refuses_an_invalid_project():
    ctx = FakeToolContext()
    _scaffold(ctx)
    write_file("support_triage/agent.py", "def (", ctx)
    result = asyncio.run(package_agent(ctx))
    assert result["status"] == "error"
    assert result["errors"]
    assert ctx.artifacts == {}


# ── workspace housekeeping ────────────────────────────────────────────


def test_sweep_removes_idle_workspaces(workspace_root):
    old = workspace_root / "old"
    fresh = workspace_root / "fresh"
    old.mkdir(parents=True)
    fresh.mkdir()
    stale = time.time() - workspace.TTL_SECONDS - 60
    os.utime(old, (stale, stale))
    assert workspace.sweep_expired() == 1
    assert not old.exists()
    assert fresh.exists()


def test_expired_project_asks_for_a_new_scaffold():
    ctx = FakeToolContext()
    _scaffold(ctx)
    import shutil

    shutil.rmtree(workspace.session_dir("u1", "s1"))
    result = write_file("a.py", "a = 1", ctx)
    assert result["status"] == "error"
    assert "Scaffold it again" in result["message"]


# ── end to end through ADK's runner ───────────────────────────────────

AGENT_PY_LINE = 'GREETING = "hello"\n'


class ScriptedLlm(BaseLlm):
    """Plays a fixed build: scaffold, write (with a wrong prefix), validate, package."""

    model: str = "scripted"
    step: int = 0

    async def generate_content_async(self, llm_request, stream=False) -> AsyncGenerator[LlmResponse, None]:
        calls = [
            ("scaffold_agent", {"name": "support-triage", "description": "Triage email"}),
            # path_guard strips the redundant project-name prefix.
            ("write_file", {"path": "support-triage/support_triage/greeting.py", "content": AGENT_PY_LINE}),
            ("validate_agent", {}),
            ("package_agent", {}),
        ]
        if self.step < len(calls):
            name, args = calls[self.step]
            self.step += 1
            part = types.Part(function_call=types.FunctionCall(name=name, args=args))
        else:
            part = types.Part(text="Your agent is ready: support-triage.zip")
        yield LlmResponse(content=types.Content(role="model", parts=[part]))


def test_build_runs_end_to_end_with_the_nuvel_chain():
    agent = Agent(
        name="adk_agent_builder",
        model=ScriptedLlm(),
        instruction="build",
        tools=get_tools(),
        before_tool_callback=root_agent.before_tool_callback,
    )
    runner = InMemoryRunner(app=App(name="adk_agent_builder", root_agent=agent, plugins=builder_plugins()))

    async def run():
        session = await runner.session_service.create_session(app_name="adk_agent_builder", user_id="u1")
        responses = {}
        async for event in runner.run_async(
            user_id="u1",
            session_id=session.id,
            new_message=types.Content(role="user", parts=[types.Part(text="Build it")]),
        ):
            for fr in event.get_function_responses():
                responses[fr.name] = fr.response
        names = await runner.artifact_service.list_artifact_keys(
            app_name="adk_agent_builder", user_id="u1", session_id=session.id
        )
        session = await runner.session_service.get_session(
            app_name="adk_agent_builder", user_id="u1", session_id=session.id
        )
        return responses, names, session

    responses, artifacts, session = asyncio.run(run())
    assert responses["scaffold_agent"]["status"] == "ok"
    assert responses["write_file"] == {
        "status": "success", "path": "support_triage/greeting.py", "bytes": len(AGENT_PY_LINE),
    }
    assert responses["validate_agent"]["status"] == "ok"
    assert responses["package_agent"]["status"] == "success"
    assert artifacts == ["support-triage.zip"]
    assert session.state[workspace.PROJECT_NAME_KEY] == "support-triage"
    assert "cost_guard" not in session.state or session.state["cost_guard"]["blocked"] is False
