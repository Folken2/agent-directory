"""list_models: the best and most-used current models on OpenRouter.

The builder's own knowledge of models goes stale, so it picks the models for a
generated agent from OpenRouter's data instead:
- the public catalogue (what is served today, prices, tool support);
- the Data API's Artificial Analysis benchmarks (intelligence, coding and
  agentic indexes) and daily usage rankings, read with OPENROUTER_API_KEY.

There is deliberately no name search: given one, the model looks up the models
it remembers, which are the old ones. Without a key, or when the Data API
fails, it falls back to the newest model of each family.
"""

from __future__ import annotations

import logging
import os
import re
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

import httpx
from google.adk.tools import FunctionTool

logger = logging.getLogger(__name__)

API = "https://openrouter.ai/api/v1"
CACHE_TTL_SECONDS = 3600
DEFAULT_LIMIT = 10
MAX_LIMIT = 30
USAGE_DAYS = 7
TASKS = ("agentic", "coding", "intelligence")
SOURCE = (
    "Benchmarks: Artificial Analysis (artificialanalysis.ai) via OpenRouter. "
    "Usage: OpenRouter (openrouter.ai/rankings). CC BY 4.0."
)
# Version-like name parts: "3.8", "v4", "0731", "4o", dates; and release tags.
_VERSIONISH = re.compile(r".*\d.*")
_RELEASE_TAGS = {"preview", "latest", "exp", "experimental", "beta"}

# key -> (fetched_at monotonic seconds, value)
_cache: dict[str, tuple[float, Any]] = {}


def _error(message: str, **extra: Any) -> dict:
    return {"status": "error", "message": message, **extra}


def _api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def _max_age_days() -> int:
    try:
        return max(1, int(os.getenv("BUILDER_MODEL_MAX_AGE_DAYS", "365")))
    except ValueError:
        return 365


async def _get(path: str, params: dict | None = None, auth: bool = False) -> Any:
    headers = {"Authorization": f"Bearer {_api_key()}"} if auth else {}
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{API}{path}", params=params, headers=headers)
        response.raise_for_status()
        data = response.json()["data"]
    if not isinstance(data, list):
        raise ValueError(f"{path}: data is not a list")
    return data


async def _fetch_catalogue() -> list[dict]:
    """Every model OpenRouter serves (public, no key). Tests replace this."""
    return await _get("/models")


async def _fetch_benchmarks(task: str) -> list[dict]:
    """Artificial Analysis rows ranked by `task`'s index. Tests replace this."""
    params = {"source": "artificial-analysis", "task_type": task, "max_results": 100}
    return await _get("/benchmarks", params, auth=True)


async def _fetch_usage() -> list[dict]:
    """Daily top-50 models by tokens over the last week. Tests replace this."""
    start = datetime.fromtimestamp(time.time(), timezone.utc).date() - timedelta(days=USAGE_DAYS)
    return await _get("/datasets/rankings-daily", {"start_date": start.isoformat()}, auth=True)


async def _cached(key: str, fetch: Callable[[], Awaitable[Any]]) -> Any:
    now = time.monotonic()
    hit = _cache.get(key)
    if hit is not None and now - hit[0] < CACHE_TTL_SECONDS:
        return hit[1]
    value = await fetch()
    _cache[key] = (now, value)
    return value


def family(model_id: str) -> str:
    """A model's line without versions, dates or variants.

    "google/gemini-3.8-flash" and "google/gemini-3.7-flash" are both
    "google/gemini-flash"; "anthropic/claude-fable-5.1" and
    "anthropic/claude-5-fable" are both "anthropic/claude-fable".
    """
    vendor, _, name = model_id.partition("/")
    name = name.split(":", 1)[0]
    parts = [p for p in name.split("-") if p and not _VERSIONISH.match(p) and p.lower() not in _RELEASE_TAGS]
    return f"{vendor}/{'-'.join(parts) or name}"


def _base_slug(slug: Any) -> str:
    return str(slug or "").split(":", 1)[0]


def _expired(value: Any) -> bool:
    if not value:
        return False
    try:
        expires = date.fromisoformat(str(value)[:10])
    except ValueError:
        return False
    return expires <= datetime.now(timezone.utc).date()


def _usable(model: Any) -> bool:
    if not isinstance(model, dict):
        return False
    model_id = model.get("id")
    if not isinstance(model_id, str) or "/" not in model_id or model_id.startswith("~"):
        return False
    # :free is rate-limited and :batch is OpenRouter's offline batch API; neither suits a live agent.
    if model_id.endswith((":free", ":batch")) or model_id.startswith("openrouter/"):
        return False
    # Stealth models are anonymous, temporary and may log prompts: not for a production agent.
    if model_id.startswith("stealth/"):
        return False
    if "tools" not in (model.get("supported_parameters") or []):
        return False
    if "text" not in ((model.get("architecture") or {}).get("output_modalities") or []):
        return False
    return not _expired(model.get("expiration_date"))


def _created(model: dict) -> int:
    try:
        return int(model.get("created") or 0)
    except (TypeError, ValueError):
        return 0


def _per_mtok(value: Any) -> float | None:
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    if price < 0:
        return None  # OpenRouter uses -1 for "variable" pricing.
    return round(price * 1_000_000, 2)


def _released(created: int) -> str | None:
    try:
        return datetime.fromtimestamp(created, timezone.utc).strftime("%Y-%m-%d") if created else None
    except (OverflowError, OSError, ValueError):
        return None


def _scores(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "intelligence": row.get("intelligence_index"),
        "coding": row.get("coding_index"),
        "agentic": row.get("agentic_index"),
    }


def _summary(model: dict, score_row: dict | None) -> dict:
    pricing = model.get("pricing") or {}
    return {
        "model": f"openrouter/{model['id']}",
        "name": model.get("name") or model["id"],
        "released": _released(_created(model)),
        "context": model.get("context_length"),
        "input_usd_per_mtok": _per_mtok(pricing.get("prompt")),
        "output_usd_per_mtok": _per_mtok(pricing.get("completion")),
        "reasoning": "reasoning" in (model.get("supported_parameters") or []),
        "scores": _scores(score_row),
    }


def _by_slug(usable: list[dict]) -> dict[str, dict]:
    """canonical_slug -> the served model; the shortest id wins (no variant suffix)."""
    out: dict[str, dict] = {}
    for model in usable:
        slug = _base_slug(model.get("canonical_slug") or model["id"])
        if slug not in out or len(model["id"]) < len(out[slug]["id"]):
            out[slug] = model
    return out


def _top_ranked(ranked: list[dict], served: dict[str, dict], vendor: str, count: int) -> list[dict]:
    """Benchmark order, one model per family, only models served with tool calling."""
    top, seen = [], set()
    for row in ranked:
        model = served.get(_base_slug(row.get("model_permaslug")))
        if model is None or (vendor and not model["id"].lower().startswith(f"{vendor}/")):
            continue
        line = family(model["id"])
        if line in seen:
            continue
        seen.add(line)
        top.append(_summary(model, row))
        if len(top) == count:
            break
    return top


def _latest_per_family(usable: list[dict], vendor: str, count: int) -> list[dict]:
    """Fallback without benchmarks: the newest model of each recent family."""
    cutoff = time.time() - _max_age_days() * 86_400
    top, seen = [], set()
    for model in sorted(usable, key=_created, reverse=True):
        if _created(model) < cutoff:
            break
        if vendor and not model["id"].lower().startswith(f"{vendor}/"):
            continue
        line = family(model["id"])
        if line in seen:
            continue
        seen.add(line)
        top.append(_summary(model, None))
        if len(top) == count:
            break
    return top


def _popular(rows: list[dict], served: dict[str, dict], scores: dict[str, dict], vendor: str,
             count: int) -> list[dict]:
    """Most tokens over the last week, summed per family, shown as its newest model."""
    tokens: dict[str, int] = defaultdict(int)
    newest: dict[str, dict] = {}
    for row in rows:
        model = served.get(_base_slug(row.get("model_permaslug")))
        if model is None or (vendor and not model["id"].lower().startswith(f"{vendor}/")):
            continue
        try:
            used = int(row.get("total_tokens") or 0)
        except (TypeError, ValueError):
            continue
        line = family(model["id"])
        tokens[line] += used
        if line not in newest or _created(model) > _created(newest[line]):
            newest[line] = model
    popular = []
    for line in sorted(tokens, key=tokens.get, reverse=True)[:count]:
        model = newest[line]
        slug = _base_slug(model.get("canonical_slug") or model["id"])
        popular.append({**_summary(model, scores.get(slug)), "weekly_tokens": tokens[line]})
    return popular


async def list_models(task: str = "agentic", provider: str = "", limit: int = DEFAULT_LIMIT) -> dict:
    """The best and the most-used current models for the agent you are designing.

    Your own knowledge of model names is out of date: call this before proposing
    models and choose only from what it returns. Each `model` value (e.g.
    "openrouter/<vendor>/<model>") goes straight into FAST_MODEL or
    REASONING_MODEL. All results support tool calling.

    Args:
        task: Which benchmark ranks `top`: "agentic" (tool use and multi-step
            work, the default and right for most agents), "coding" or
            "intelligence" (general reasoning).
        provider: Optional vendor, the part of the id before "/" (e.g.
            "anthropic", "google", "openai"), when the user wants one.
        limit: Models per list, 1 to 30 (default 10).

    Returns:
        {"status": "success", "task", "top": [...], "popular": [...], "source",
        "note"?}. `top` is ranked by the task's benchmark score, best first, one
        model per family. `popular` is ranked by tokens used on OpenRouter over
        the last week (`weekly_tokens`); cheap, heavily used models there make
        good FAST_MODEL choices. Each model has `scores` (intelligence, coding,
        agentic; higher is better, null when not benchmarked), USD prices per
        million tokens, context size, release date and `reasoning`. Cite
        `source` when you present the scores. `note` explains missing data.
    """
    kind = (task or "agentic").strip().lower()
    if kind not in TASKS:
        return _error(f"Unknown task {task!r}; use one of: {', '.join(TASKS)}.")
    vendor = (provider or "").strip().lower()
    try:
        count = max(1, min(MAX_LIMIT, int(limit)))
    except (TypeError, ValueError):
        count = DEFAULT_LIMIT

    try:
        catalogue = await _cached("catalogue", _fetch_catalogue)
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Fetching the OpenRouter catalogue failed: %s", exc)
        return _error(f"Could not fetch the OpenRouter model list: {exc}")
    usable = [m for m in catalogue if _usable(m)]
    served = _by_slug(usable)

    if not _api_key():
        return {
            "status": "success",
            "task": kind,
            "top": _latest_per_family(usable, vendor, count),
            "popular": [],
            "source": "OpenRouter model catalogue.",
            "note": "No benchmarks or usage data: OPENROUTER_API_KEY is not set. "
                    "`top` is the newest model of each family.",
        }

    notes = []
    ranked: list[dict] = []
    try:
        ranked = await _cached(f"benchmarks:{kind}", lambda: _fetch_benchmarks(kind))
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Fetching OpenRouter benchmarks failed: %s", exc)
        notes.append("Benchmarks unavailable right now; `top` is the newest model of each family.")
    scores = {_base_slug(r.get("model_permaslug")): r for r in ranked if isinstance(r, dict)}
    top = (
        _top_ranked([r for r in ranked if isinstance(r, dict)], served, vendor, count)
        if ranked else _latest_per_family(usable, vendor, count)
    )

    popular: list[dict] = []
    try:
        usage = await _cached("usage", _fetch_usage)
        popular = _popular([r for r in usage if isinstance(r, dict)], served, scores, vendor, count)
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Fetching OpenRouter usage rankings failed: %s", exc)
        notes.append("Usage rankings unavailable right now; `popular` is empty.")

    result = {"status": "success", "task": kind, "top": top, "popular": popular, "source": SOURCE}
    if notes:
        result["note"] = " ".join(notes)
    return result


list_models_tool = FunctionTool(list_models)
