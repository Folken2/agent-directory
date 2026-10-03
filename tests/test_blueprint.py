import asyncio
import json
import re
from types import SimpleNamespace

from google.genai import types

from agents.adk_agent_builder.blueprint import (
    BLUEPRINT_STATE_KEY,
    extract_blueprint,
    parse_blueprint,
)
from agents.adk_agent_builder.callbacks.blueprint_document import capture_blueprint
from agents.adk_agent_builder.prompt.prompt import prompt_v2

VALID = {
    "name": "Support triage",
    "goal": "Triage support emails and draft replies.",
    "agents": [
        {"name": "root_agent", "role": "Routes emails", "kind": "sequential", "subAgents": ["drafter"]},
        {"name": "drafter", "role": "Drafts replies", "model": "gemini-2.5-flash", "tools": ["search_kb"]},
    ],
    "tools": [{"name": "search_kb", "kind": "function", "purpose": "Search the help center"}],
    "dataSources": [{"name": "Help center", "purpose": "Answers"}],
    "models": [{"model": "gemini-2.5-flash", "usedBy": ["drafter"], "reason": "Fast and cheap"}],
    "risks": ["Wrong refunds"],
    "nextSteps": ["Write search_kb"],
}


def fenced(doc, before="Here is the design.", after=""):
    return f"{before}\n\n```blueprintjson\n{json.dumps(doc)}\n```\n{after}"


def test_parse_valid_blueprint_round_trips_camel_case():
    bp = parse_blueprint(VALID)
    assert bp is not None
    state = bp.to_state()
    assert state["agents"][0]["subAgents"] == ["drafter"]
    assert state["models"][0]["usedBy"] == ["drafter"]
    assert state["dataSources"][0]["name"] == "Help center"
    assert "codeSkeleton" not in state  # None fields are dropped


def test_parse_rejects_invalid_documents():
    assert parse_blueprint({**VALID, "agents": []}) is None
    assert parse_blueprint({**VALID, "agents": [{"name": "x", "role": "y", "kind": "robot"}]}) is None
    assert parse_blueprint({"goal": "no name"}) is None
    assert parse_blueprint("nope") is None


def test_extract_strips_fence_only_when_valid():
    bp, display = extract_blueprint(fenced(VALID, after="Want changes?"))
    assert bp and bp.name == "Support triage"
    assert "blueprintjson" not in display
    assert display.startswith("Here is the design.") and display.endswith("Want changes?")

    text = "```blueprintjson\n{not json}\n```"
    assert extract_blueprint(text) == (None, text)
    assert extract_blueprint("no fence") == (None, "no fence")


def _response(*parts):
    return SimpleNamespace(content=SimpleNamespace(parts=list(parts)))


def test_callback_stores_state_and_rewrites_prose():
    ctx = SimpleNamespace(state={})
    thought = types.Part(text="planning", thought=True)
    resp = _response(thought, types.Part(text=fenced(VALID)))
    asyncio.run(capture_blueprint(ctx, resp))
    assert ctx.state[BLUEPRINT_STATE_KEY]["name"] == "Support triage"
    texts = [p.text for p in resp.content.parts]
    assert texts[0] == "planning"
    assert texts[-1] == "Here is the design."


def test_callback_is_a_noop_without_a_blueprint_or_with_pending_tool_calls():
    ctx = SimpleNamespace(state={})
    plain = _response(types.Part(text="Just an answer"))
    asyncio.run(capture_blueprint(ctx, plain))
    assert ctx.state == {}
    assert plain.content.parts[0].text == "Just an answer"

    call = types.Part(function_call=types.FunctionCall(name="fetch_docs", args={}))
    pending = _response(types.Part(text=fenced(VALID)), call)
    asyncio.run(capture_blueprint(ctx, pending))
    assert ctx.state == {}


def test_prompt_json_example_survives_adk_state_templating():
    # ADK replaces {identifier} placeholders in instructions with state values;
    # the JSON example must not contain anything that looks like one.
    placeholders = re.findall(r"{+([^{}]*)}+", prompt_v2)
    ident = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*\??$|^(app|user|temp):[A-Za-z_][A-Za-z0-9_]*\??$")
    assert not [p for p in placeholders if ident.match(p.strip())]
