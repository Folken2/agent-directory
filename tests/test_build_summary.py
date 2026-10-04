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
