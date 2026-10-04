"""list_models: benchmark-ranked and most-used OpenRouter models for the agents the builder writes."""

import asyncio
from datetime import datetime, timezone

import httpx
import pytest

from agents.adk_agent_builder.prompt.prompt import PROMPT_V3
from agents.adk_agent_builder.tools import get_tools
from agents.adk_agent_builder.tools import model_tools
from agents.adk_agent_builder.tools.model_tools import family, list_models, list_models_tool

DAY = 86_400
NOW = 1_790_000_000


def _model(id_, slug, age_days, *, params=("tools",), out=("text",), expires=None,
           prompt="0.000001", completion="0.000002"):
    return {
        "id": id_,
        "canonical_slug": slug,
        "name": id_,
        "created": NOW - age_days * DAY,
        "context_length": 128_000,
        "pricing": {"prompt": prompt, "completion": completion},
        "supported_parameters": list(params),
        "architecture": {"output_modalities": list(out)},
        "knowledge_cutoff": None,
        "expiration_date": expires,
    }


CATALOG = [
    _model("google/gemini-3.8-flash", "google/gemini-3.8-flash-20260902", 30, params=("tools", "reasoning")),
    _model("google/gemini-3.8-flash:batch", "google/gemini-3.8-flash-20260902", 30),
    _model("google/gemini-3.7-flash", "google/gemini-3.7-flash-20260813", 50),
    _model("anthropic/claude-fable-5.1", "anthropic/claude-fable-5.1-20260831", 35, prompt="0.000005"),
    _model("anthropic/claude-5-fable", "anthropic/claude-5-fable-20260609", 100),
    _model("anthropic/claude-opus-5", "anthropic/claude-opus-5-20260723", 70, prompt="0.000015"),
    _model("deepseek/deepseek-v4-flash-0731", "deepseek/deepseek-v4-flash-20260731", 60, prompt="0.0000001"),
    _model("openai/gpt-4o-2024-08-06", "openai/gpt-4o-2024-08-06", 800),
    _model("meta/no-tools", "meta/no-tools-20260901", 10, params=("temperature",)),
    _model("acme/expired", "acme/expired-20260101", 10, expires="2020-01-01"),
    _model("stealth/space-bunny-alpha", "stealth/space-bunny-alpha", 5, prompt="0", completion="0"),
]


def _score(slug, agentic, coding):
    return {"model_permaslug": slug, "intelligence_index": 40.0, "coding_index": coding, "agentic_index": agentic}


BENCHMARKS = [
    _score("meta/no-tools-20260901", 60.0, 90.0),             # no tool calling: excluded
    _score("anthropic/claude-fable-5.1-20260831", 57.9, 81.6),
    _score("anthropic/claude-opus-5-20260723", 56.5, 78.0),
    _score("unknown/not-in-catalogue-20260901", 55.0, 70.0),  # not served: excluded
    _score("anthropic/claude-5-fable-20260609", 50.7, 85.0),  # same family as fable-5.1
    _score("google/gemini-3.8-flash-20260902", 45.0, 70.0),
]

USAGE = [
    {"date": "2026-09-30", "model_permaslug": "deepseek/deepseek-v4-flash-20260731", "total_tokens": "900"},
    {"date": "2026-10-01", "model_permaslug": "deepseek/deepseek-v4-flash-20260731", "total_tokens": "900"},
    {"date": "2026-10-01", "model_permaslug": "google/gemini-3.7-flash-20260813", "total_tokens": "1000"},
    {"date": "2026-10-01", "model_permaslug": "google/gemini-3.8-flash-20260902", "total_tokens": "500"},
    {"date": "2026-10-01", "model_permaslug": "minimax/minimax-m3-20260531:free", "total_tokens": "5000"},
    {"date": "2026-10-01", "model_permaslug": "other", "total_tokens": "99999"},
    # Anonymous, temporary test models: never for a production agent.
    {"date": "2026-10-01", "model_permaslug": "stealth/space-bunny-alpha", "total_tokens": "99999"},
]


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    calls = {"catalogue": 0, "benchmarks": [], "usage": 0}

    async def catalogue():
        calls["catalogue"] += 1
        return CATALOG

    async def benchmarks(task):
        calls["benchmarks"].append(task)
        key = {"agentic": "agentic_index", "coding": "coding_index"}.get(task, "intelligence_index")
        return sorted(BENCHMARKS, key=lambda r: r[key], reverse=True)

    async def usage():
        calls["usage"] += 1
        return USAGE

    monkeypatch.setattr(model_tools, "_fetch_catalogue", catalogue)
    monkeypatch.setattr(model_tools, "_fetch_benchmarks", benchmarks)
    monkeypatch.setattr(model_tools, "_fetch_usage", usage)
    monkeypatch.setattr(model_tools, "_cache", {})
    monkeypatch.setattr(model_tools.time, "time", lambda: NOW)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    return calls


def run(**kwargs):
    return asyncio.run(list_models(**kwargs))


def ids(models):
    return [m["model"] for m in models]


def test_family_strips_versions_dates_and_variants():
    assert family("google/gemini-3.8-flash") == family("google/gemini-3.7-flash") == "google/gemini-flash"
    assert family("anthropic/claude-fable-5.1") == family("anthropic/claude-5-fable") == "anthropic/claude-fable"
    assert family("deepseek/deepseek-v4-flash-0731") == "deepseek/deepseek-flash"
    assert family("openai/gpt-4o-2024-08-06:batch") == "openai/gpt"


def test_top_is_ranked_by_the_task_benchmark_one_per_family():
    result = run()
    assert result["status"] == "success"
    assert result["task"] == "agentic"
    assert ids(result["top"]) == [
        "openrouter/anthropic/claude-fable-5.1",
        "openrouter/anthropic/claude-opus-5",
        "openrouter/google/gemini-3.8-flash",
    ]
    first = result["top"][0]
    assert first["scores"] == {"intelligence": 40.0, "coding": 81.6, "agentic": 57.9}
    assert first["input_usd_per_mtok"] == 5.0
    assert first["released"] == datetime.fromtimestamp(NOW - 35 * DAY, timezone.utc).strftime("%Y-%m-%d")


def test_coding_task_uses_the_coding_ranking(fakes):
    result = run(task="Coding")
    assert fakes["benchmarks"] == ["coding"]
    # claude-5-fable scores higher than fable-5.1 on coding, so it represents the family.
    assert ids(result["top"])[0] == "openrouter/anthropic/claude-5-fable"


def test_unknown_task_is_an_error():
    result = run(task="vibes")
    assert result["status"] == "error"
    assert "agentic" in result["message"]


def test_popular_sums_last_week_by_family_and_shows_the_newest_model():
    popular = run()["popular"]
    # deepseek: 900 + 900; gemini-flash family: 1000 (3.7) + 500 (3.8), shown as the newest, 3.8.
    assert ids(popular) == ["openrouter/deepseek/deepseek-v4-flash-0731", "openrouter/google/gemini-3.8-flash"]
    assert popular[0]["weekly_tokens"] == 1800
    assert popular[1]["weekly_tokens"] == 1500
    assert popular[1]["scores"]["agentic"] == 45.0
    assert popular[0]["scores"] is None


def test_provider_filters_both_lists():
    result = run(provider="Google")
    assert ids(result["top"]) == ["openrouter/google/gemini-3.8-flash"]
    assert ids(result["popular"]) == ["openrouter/google/gemini-3.8-flash"]


def test_sources_are_cited():
    assert "Artificial Analysis" in run()["source"]


def test_limit_is_clamped():
    assert len(run(limit=1)["top"]) == 1
    assert len(run(limit=0)["top"]) == 1
    assert len(run(limit=1000)["top"]) == 3


def test_without_a_key_it_falls_back_to_the_latest_model_per_family(monkeypatch, fakes):
    monkeypatch.delenv("OPENROUTER_API_KEY")
    result = run()
    assert result["status"] == "success"
    assert fakes["benchmarks"] == [] and fakes["usage"] == 0
    assert ids(result["top"]) == [
        "openrouter/google/gemini-3.8-flash",
        "openrouter/anthropic/claude-fable-5.1",
        "openrouter/deepseek/deepseek-v4-flash-0731",
        "openrouter/anthropic/claude-opus-5",
    ]  # gpt-4o is older than the age limit; older family members are dropped
    assert result["top"][0]["scores"] is None
    assert result["popular"] == []
    assert "OPENROUTER_API_KEY" in result["note"]


def test_max_age_is_configurable(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY")
    monkeypatch.setenv("BUILDER_MODEL_MAX_AGE_DAYS", "40")
    assert ids(run()["top"]) == ["openrouter/google/gemini-3.8-flash", "openrouter/anthropic/claude-fable-5.1"]


def test_benchmark_failure_falls_back(monkeypatch):
    async def boom(task):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(model_tools, "_fetch_benchmarks", boom)
    result = run()
    assert result["status"] == "success"
    assert result["top"][0]["scores"] is None
    assert result["note"]


def test_usage_failure_keeps_the_ranking(monkeypatch):
    async def boom():
        raise httpx.ConnectError("down")

    monkeypatch.setattr(model_tools, "_fetch_usage", boom)
    result = run()
    assert ids(result["top"])[0] == "openrouter/anthropic/claude-fable-5.1"
    assert result["popular"] == []
    assert result["note"]


def test_catalogue_failure_is_an_error(monkeypatch):
    async def boom():
        raise httpx.ConnectError("down")

    monkeypatch.setattr(model_tools, "_fetch_catalogue", boom)
    assert run()["status"] == "error"


def test_fetches_are_cached(fakes, monkeypatch):
    clock = {"t": 1000.0}
    monkeypatch.setattr(model_tools.time, "monotonic", lambda: clock["t"])
    run()
    run(provider="google")
    assert fakes["catalogue"] == 1 and fakes["benchmarks"] == ["agentic"] and fakes["usage"] == 1
    clock["t"] += model_tools.CACHE_TTL_SECONDS + 1
    run()
    assert fakes["catalogue"] == 2


def test_no_name_search_and_prompted():
    assert list_models_tool in get_tools()
    assert "query" not in list_models.__code__.co_varnames[: list_models.__code__.co_argcount]
    assert "list_models" in PROMPT_V3
    assert "out of date" in PROMPT_V3
