"""The builder's sandbox: gating, limits, step reporting, and one real run.

E2B is never called. Most tests use a scripted environment; one runs a
scaffolded project for real through ADK's LocalEnvironment, standing in for
the E2B sandbox (local execution is for tests only, never the server).
"""

import asyncio
import sys
from pathlib import Path

import pytest
from google.adk.environment._base_environment import ExecutionResult
from google.adk.environment._local_environment import LocalEnvironment

from agents.adk_agent_builder import sandbox, workspace
from agents.adk_agent_builder.prompt.prompt import build_prompt_v3
from agents.adk_agent_builder.tools import get_tools
from agents.adk_agent_builder.tools.project_tools import write_file
from agents.adk_agent_builder.tools.sandbox_tools import run_checks, run_in_sandbox
from test_agent_builder import FakeToolContext, _scaffold

SIGNED_IN = "u_123"


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace, "ROOT", tmp_path / "workspaces")
    monkeypatch.setenv("E2B_API_KEY", "test-key")
    monkeypatch.delenv("BUILDER_SANDBOX_SIGNED_IN_ONLY", raising=False)
    sandbox._active.clear()
    yield
    sandbox._active.clear()


class ScriptedEnvironment:
    """Records commands; `responses` maps a command substring to a result."""

    instances: list["ScriptedEnvironment"] = []

    def __init__(self, responses=None):
        self.responses = responses or {}
        self.commands: list[str] = []
        self.files: dict[str, bytes] = {}
        self.background: list[dict] = []
        self.killed: list[int] = []
        self.alive = True
        self.is_initialized = False
        self.closed = False
        ScriptedEnvironment.instances.append(self)

    async def start_background(self, command, *, cwd, envs):
        self.background.append({"command": command, "cwd": cwd, "envs": envs})
        return 4242

    async def kill(self, pid):
        self.killed.append(pid)

    def endpoint(self, port):
        return f"https://{port}-sbx.e2b.app", {"e2b-traffic-access-token": "traffic-token"}

    async def keepalive(self):
        return self.alive

    @property
    def working_dir(self):
        return Path("/home/user")

    async def initialize(self):
        self.is_initialized = True

    async def close(self):
        self.closed = True

    async def write_file(self, path, content):
        self.files[str(path)] = content

    async def execute(self, command, *, timeout=None):
        self.commands.append(command)
        for needle, result in self.responses.items():
            if needle in command:
                return result
        if command.startswith("test -f"):
            return ExecutionResult(exit_code=1)
        return ExecutionResult(exit_code=0, stdout="ok")


def _use(monkeypatch, responses=None):
    ScriptedEnvironment.instances = []
    monkeypatch.setattr(sandbox, "new_environment", lambda: ScriptedEnvironment(responses))


def _ctx(user_id=SIGNED_IN, session_id="s1"):
    ctx = FakeToolContext(user_id=user_id, session_id=session_id)
    assert _scaffold(ctx)["status"] == "ok"
    return ctx


# ── wiring ────────────────────────────────────────────────────────────


def test_tools_and_prompt_only_with_an_e2b_key(monkeypatch):
    assert {"run_checks", "run_in_sandbox"} <= {t.name for t in get_tools()}
    assert "# Running the project" in build_prompt_v3({}, sandbox=True)
    monkeypatch.delenv("E2B_API_KEY")
    assert not {"run_checks", "run_in_sandbox"} & {t.name for t in get_tools()}
    assert "# Running the project" not in build_prompt_v3({}, sandbox=False)


def test_sandbox_gets_no_server_secrets(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "server-secret")
    env = sandbox.new_environment()
    assert env._env_vars == sandbox.SANDBOX_ENV
    assert "OPENROUTER_API_KEY" not in env._env_vars
    # The TTL outlasts the longest command.
    assert env._timeout >= sandbox.INSTALL_TIMEOUT + 60


# ── gate and limits ───────────────────────────────────────────────────


def test_anonymous_users_are_asked_to_sign_in(monkeypatch):
    _use(monkeypatch)
    ctx = _ctx(user_id="a_anon-token")
    result = asyncio.run(run_checks(ctx))
    assert result["status"] == "sign_in_required"
    assert ScriptedEnvironment.instances == []
    assert sandbox.RUNS_STATE_KEY not in ctx.state


def test_signed_in_only_can_be_switched_off_for_local_dev(monkeypatch):
    _use(monkeypatch)
    monkeypatch.setenv("BUILDER_SANDBOX_SIGNED_IN_ONLY", "0")
    assert asyncio.run(run_checks(_ctx(user_id="user")))["status"] == "passed"


def test_runs_per_chat_are_capped(monkeypatch):
    _use(monkeypatch)
    monkeypatch.setattr(sandbox, "MAX_RUNS", 1)
    ctx = _ctx()
    first = asyncio.run(run_checks(ctx))
    assert first["status"] == "passed" and first["runs_left"] == 0
    second = asyncio.run(run_in_sandbox("ls", ctx))
    assert second["status"] == "error"
    assert "sandbox runs" in second["message"]


def test_active_sandboxes_are_capped(monkeypatch):
    _use(monkeypatch)
    monkeypatch.setattr(sandbox, "MAX_ACTIVE", 1)
    assert asyncio.run(run_checks(_ctx(session_id="a")))["status"] == "passed"
    busy = asyncio.run(run_checks(_ctx(session_id="b")))
    assert busy["status"] == "error"
    assert "in use" in busy["message"]


def test_idle_sandboxes_are_closed(monkeypatch):
    _use(monkeypatch)
    asyncio.run(run_checks(_ctx(session_id="a")))
    env = ScriptedEnvironment.instances[0]
    for box in sandbox._active.values():
        box.last_used -= sandbox.TTL_SECONDS + 1
    asyncio.run(run_checks(_ctx(session_id="b")))
    assert env.closed
    assert len(sandbox._active) == 1


def test_one_sandbox_per_session(monkeypatch):
    _use(monkeypatch)
    ctx = _ctx()
    asyncio.run(run_checks(ctx))
    asyncio.run(run_in_sandbox("ls", ctx))
    assert len(ScriptedEnvironment.instances) == 1


# ── run_checks ────────────────────────────────────────────────────────


def test_checks_run_every_step_in_the_project(monkeypatch):
    _use(monkeypatch)
    ctx = _ctx()
    result = asyncio.run(run_checks(ctx))
    assert result["status"] == "passed", result
    assert [s["step"] for s in result["steps"]] == ["python", "install", "import", "tests"]
    env = ScriptedEnvironment.instances[0]
    assert "/home/user/.builder/upload.tar.gz" in env.files
    project = "cd /home/user/projects/support-triage && "
    assert any(c.startswith(project) and "pip install -q -r requirements.txt pytest" in c for c in env.commands)
    assert project + 'python3 -c "import support_triage.agent"' in env.commands
    assert project + "python3 -m pytest -q -p no:cacheprovider" in env.commands


def test_install_is_skipped_when_requirements_are_unchanged(monkeypatch):
    _use(monkeypatch, {"test -f": ExecutionResult(exit_code=0)})
    result = asyncio.run(run_checks(_ctx()))
    install = result["steps"][1]
    assert install["ok"] and "already installed" in install["note"]
    assert not any("pip install" in c for c in ScriptedEnvironment.instances[0].commands)


def test_checks_stop_at_the_first_failure(monkeypatch):
    error = ExecutionResult(exit_code=1, stderr="ModuleNotFoundError: No module named 'httpx'")
    _use(monkeypatch, {"import support_triage.agent": error})
    result = asyncio.run(run_checks(_ctx()))
    assert result["status"] == "failed"
    assert [s["step"] for s in result["steps"]] == ["python", "install", "import"]
    assert "httpx" in result["steps"][-1]["stderr"]
    assert not any("pytest -q" in c for c in ScriptedEnvironment.instances[0].commands)


def test_no_tests_collected_passes_with_a_note(monkeypatch):
    _use(monkeypatch, {"-m pytest": ExecutionResult(exit_code=5, stdout="no tests ran")})
    result = asyncio.run(run_checks(_ctx()))
    assert result["status"] == "passed"
    assert result["steps"][-1]["note"] == "No tests were collected."


def test_old_python_points_at_the_template(monkeypatch):
    _use(monkeypatch, {"sys.version_info": ExecutionResult(exit_code=1, stdout="3.10.12")})
    result = asyncio.run(run_checks(_ctx()))
    assert result["status"] == "failed"
    assert "BUILDER_E2B_TEMPLATE" in result["steps"][0]["note"]


def test_output_is_cut_to_a_tail(monkeypatch):
    long = "x" * (sandbox.OUTPUT_TAIL_CHARS * 3) + "THE END"
    _use(monkeypatch, {"-m pytest": ExecutionResult(exit_code=1, stdout=long)})
    stdout = asyncio.run(run_checks(_ctx()))["steps"][-1]["stdout"]
    assert len(stdout) <= sandbox.OUTPUT_TAIL_CHARS + 1
    assert stdout.endswith("THE END")


def test_start_failure_is_reported(monkeypatch):
    class Broken(ScriptedEnvironment):
        async def initialize(self):
            raise RuntimeError("e2b down")

    monkeypatch.setattr(sandbox, "new_environment", lambda: Broken())
    result = asyncio.run(run_checks(_ctx()))
    assert result["status"] == "error"
    assert "Could not start a sandbox" in result["message"]
    assert sandbox._active == {}


# ── run_in_sandbox ────────────────────────────────────────────────────


def test_command_exit_code_is_a_result_not_a_tool_failure(monkeypatch):
    _use(monkeypatch, {"pytest -x": ExecutionResult(exit_code=1, stdout="1 failed")})
    result = asyncio.run(run_in_sandbox("python3 -m pytest -x", _ctx()))
    assert result["status"] == "ok"
    assert "exit_code" not in result  # nuvel's RepeatedFailureGuard reads top-level exit_code
    assert result["result"]["exit_code"] == 1
    assert result["result"]["stdout"] == "1 failed"


def test_command_limits(monkeypatch):
    _use(monkeypatch)
    ctx = _ctx()
    assert asyncio.run(run_in_sandbox("   ", ctx))["status"] == "error"
    assert asyncio.run(run_in_sandbox("x" * 5000, ctx))["status"] == "error"


# ── a real run ────────────────────────────────────────────────────────


class LocalSandbox(LocalEnvironment):
    """LocalEnvironment that skips pip: the test interpreter already has the deps."""

    async def execute(self, command, *, timeout=None):
        if "-m pip install" in command:
            return ExecutionResult(exit_code=0)
        return await super().execute(command, timeout=timeout)


def test_a_scaffolded_project_runs_for_real(tmp_path, monkeypatch):
    box = tmp_path / "sandbox"
    monkeypatch.setattr(sandbox, "new_environment", lambda: LocalSandbox(working_dir=box))
    monkeypatch.setattr(sandbox, "PYTHON", sys.executable)
    ctx = _ctx()

    result = asyncio.run(run_checks(ctx))
    assert result["status"] == "passed", result
    assert (box / "projects" / "support-triage" / "support_triage" / "agent.py").is_file()
    assert not (box / ".builder" / "upload.tar.gz").exists()

    # A broken file fails the import step, with the traceback.
    write_file("support_triage/agent.py", "raise RuntimeError('boom')\n", ctx)
    failed = asyncio.run(run_checks(ctx))
    assert failed["status"] == "failed"
    assert failed["steps"][-1]["step"] == "import"
    assert "boom" in failed["steps"][-1]["stderr"]

    # Uploads mirror the workspace in place: a file removed from the workspace
    # disappears, while files the running code made (memory, traces) stay.
    asyncio.run(run_in_sandbox("touch made-by-the-agent.txt", ctx))
    write_file("notes.md", "temporary", ctx)
    asyncio.run(run_in_sandbox("test -f notes.md", ctx))
    (workspace.session_dir("u_123", "s1") / "support-triage" / "notes.md").unlink()
    gone = asyncio.run(run_in_sandbox("test -f notes.md", ctx))
    assert gone["result"]["exit_code"] == 1
    kept = asyncio.run(run_in_sandbox("test -f made-by-the-agent.txt", ctx))
    assert kept["result"]["exit_code"] == 0
    asyncio.run(sandbox.close_all())
