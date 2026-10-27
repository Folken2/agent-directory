import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from google.adk.models.google_llm import Gemini
from google.adk.models.lite_llm import LiteLlm
from google.adk.models.llm_request import LlmRequest
from google.genai import types
import model_factory
from model_factory import make_gemini, make_model

CHAT_REPLY = {
    "id": "chatcmpl-1",
    "object": "chat.completion",
    "created": 0,
    "model": "openrouter/google/gemini-3-flash-preview",
    "choices": [
        {
            "index": 0,
            "message": {"role": "assistant", "content": "pong"},
            "finish_reason": "stop",
        }
    ],
    "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
}

GEMINI_REPLY = {
    "candidates": [
        {
            "content": {"role": "model", "parts": [{"text": "pong"}]},
            "finishReason": "STOP",
        }
    ],
    "usageMetadata": {
        "promptTokenCount": 1,
        "candidatesTokenCount": 1,
        "totalTokenCount": 2,
    },
}


def _serve(status=200, body=None):
    """A local HTTP server that records each POST and answers with `status`.
    Replies with a chat completion or a Gemini response unless `body` is given."""
    seen = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            seen.append(
                {
                    "path": self.path,
                    "headers": {k.lower(): v for k, v in self.headers.items()},
                    "body": json.loads(raw or b"{}"),
                }
            )
            gemini = "generateContent" in self.path
            reply = body or (GEMINI_REPLY if gemini else CHAT_REPLY)
            data = json.dumps(reply).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, seen


@pytest.fixture
def proxy(monkeypatch):
    """A stand-in LiteLLM proxy that records each request it receives."""
    server, seen = _serve()
    monkeypatch.setenv("LITELLM_PROXY_URL", f"http://127.0.0.1:{server.server_port}")
    monkeypatch.setenv("LITELLM_PROXY_ENABLED", "true")
    yield seen
    server.shutdown()


@pytest.fixture
def provider(monkeypatch):
    """Stand-ins for OpenRouter and the Gemini API, for direct calls."""
    server, seen = _serve()
    url = f"http://127.0.0.1:{server.server_port}"
    monkeypatch.setenv("OPENROUTER_API_BASE", url)
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-direct")
    monkeypatch.setenv("GOOGLE_GEMINI_BASE_URL", url)
    monkeypatch.setenv("GOOGLE_API_KEY", "real-gemini-key")
    yield seen
    server.shutdown()


# What Railway's edge answers when a domain has no running deployment
RAILWAY_NOT_FOUND = {
    "status": "error",
    "code": 404,
    "message": "Application not found",
    "request_id": "abc",
}


def _gateway(monkeypatch, status, body):
    server, seen = _serve(status, body)
    monkeypatch.setenv("LITELLM_PROXY_URL", f"http://127.0.0.1:{server.server_port}")
    monkeypatch.setenv("LITELLM_PROXY_ENABLED", "true")
    monkeypatch.setenv("LITELLM_PROXY_API_KEY", "sk-shared")
    return server, seen


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for var in (
        "LITELLM_PROXY_URL",
        "LITELLM_PROXY_ENABLED",
        "LITELLM_PROXY_API_KEY",
        "LITELLM_KEY_DEEP_RESEARCH_AGENT",
        "LITELLM_KEY_DATA_ANALYST_AGENT",
        "FAST_MODEL",
        "REASONING_MODEL",
        "REASONING_EFFORT",
        "OPENROUTER_API_BASE",
        "GOOGLE_GEMINI_BASE_URL",
    ):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setattr(model_factory, "_gateway_down_until", 0.0)


def _ask(model, name):
    request = LlmRequest(
        model=name,
        contents=[types.Content(role="user", parts=[types.Part(text="ping")])],
        config=types.GenerateContentConfig(),
    )

    async def run():
        return [r async for r in model.generate_content_async(request, stream=False)]

    responses = asyncio.run(run())
    return responses[-1].content.parts[0].text


def test_direct_by_default():
    model = make_model("deep_research_agent")
    assert isinstance(model, LiteLlm)
    assert model.model == "openrouter/google/gemini-3.8-flash"
    reasoning = make_model("deep_research_agent", "reasoning")
    assert reasoning.model == "openrouter/deepseek/deepseek-v4.1-flash"
    assert reasoning._additional_args["extra_body"] == {
        "reasoning": {"effort": "medium"}
    }
    assert "extra_body" not in model._additional_args
    assert make_gemini("data_analyst_agent", "gemini-2.5-flash") == "gemini-2.5-flash"


def test_tier_env_override(monkeypatch):
    monkeypatch.setenv("FAST_MODEL", "openrouter/acme/fast")
    assert make_model("deep_research_agent").model == "openrouter/acme/fast"


def test_reasoning_effort_env_override(monkeypatch):
    monkeypatch.setenv("REASONING_EFFORT", "high")
    model = make_model("deep_research_agent", "reasoning")
    assert model._additional_args["extra_body"] == {"reasoning": {"effort": "high"}}


def test_unknown_tier():
    with pytest.raises(ValueError, match="tier"):
        make_model("deep_research_agent", "huge")


def test_proxied_litellm_uses_agent_key_and_tags(proxy, monkeypatch):
    monkeypatch.setenv("LITELLM_KEY_DEEP_RESEARCH_AGENT", "sk-deep")
    monkeypatch.setenv("LITELLM_PROXY_API_KEY", "sk-shared")
    model = make_model("deep_research_agent", "reasoning")

    assert _ask(model, model.model) == "pong"
    (call,) = proxy
    assert call["path"].endswith("/chat/completions")
    assert call["headers"]["authorization"] == "Bearer sk-deep"
    # The proxy sees the original model name, which its model_list matches.
    assert call["body"]["model"] == "openrouter/deepseek/deepseek-v4.1-flash"
    # OpenRouter's own field: LiteLLM rejects `reasoning_effort` for models
    # missing from its price list.
    assert call["body"]["reasoning"] == {"effort": "medium"}
    assert "reasoning_effort" not in call["body"]
    assert call["body"]["metadata"]["tags"] == [
        "agent:deep_research_agent",
        "tier:reasoning",
    ]


def test_proxied_litellm_falls_back_to_shared_key(proxy, monkeypatch):
    monkeypatch.setenv("LITELLM_PROXY_API_KEY", "sk-shared")
    model = make_model("deep_research_agent")

    assert _ask(model, model.model) == "pong"
    assert proxy[0]["headers"]["authorization"] == "Bearer sk-shared"


@pytest.mark.parametrize("flag", [None, "false", "0", "no", ""])
def test_flag_off_stays_direct_even_with_proxy_settings(monkeypatch, flag):
    monkeypatch.setenv("LITELLM_PROXY_URL", "http://proxy.example:4000")
    monkeypatch.setenv("LITELLM_PROXY_API_KEY", "sk-shared")
    if flag is None:
        monkeypatch.delenv("LITELLM_PROXY_ENABLED", raising=False)
    else:
        monkeypatch.setenv("LITELLM_PROXY_ENABLED", flag)
    assert (
        make_model("deep_research_agent").model == "openrouter/google/gemini-3.8-flash"
    )
    assert make_gemini("data_analyst_agent", "gemini-2.5-flash") == "gemini-2.5-flash"


@pytest.mark.parametrize("flag", ["true", "True", "1", "yes", "on"])
def test_flag_on_uses_proxy(monkeypatch, flag):
    monkeypatch.setenv("LITELLM_PROXY_URL", "http://proxy.example:4000")
    monkeypatch.setenv("LITELLM_PROXY_API_KEY", "sk-shared")
    monkeypatch.setenv("LITELLM_PROXY_ENABLED", flag)
    model = make_model("deep_research_agent")
    assert model.model == "litellm_proxy/openrouter/google/gemini-3.8-flash"
    assert isinstance(make_gemini("data_analyst_agent", "gemini-2.5-flash"), Gemini)


def test_flag_on_without_url_fails_loudly(monkeypatch):
    monkeypatch.setenv("LITELLM_PROXY_ENABLED", "true")
    monkeypatch.setenv("LITELLM_PROXY_API_KEY", "sk-shared")
    with pytest.raises(RuntimeError, match="LITELLM_PROXY_URL"):
        make_model("deep_research_agent")


def test_proxied_without_any_key_fails_loudly(proxy):
    with pytest.raises(RuntimeError, match="LITELLM_KEY_DEEP_RESEARCH_AGENT"):
        make_model("deep_research_agent")


def test_proxied_gemini_goes_through_passthrough(proxy, monkeypatch):
    monkeypatch.setenv("LITELLM_KEY_DATA_ANALYST_AGENT", "sk-analyst")
    monkeypatch.setenv("GOOGLE_API_KEY", "real-gemini-key")
    model = make_gemini("data_analyst_agent", "gemini-2.5-flash")
    assert isinstance(model, Gemini)

    assert _ask(model, "gemini-2.5-flash") == "pong"
    (call,) = proxy
    assert call["path"].startswith(
        "/gemini/v1beta/models/gemini-2.5-flash:generateContent"
    )
    # The agent's proxy key, never the real Gemini key from the environment.
    assert call["headers"]["x-goog-api-key"] == "sk-analyst"


@pytest.mark.parametrize("status, body", [(404, RAILWAY_NOT_FOUND), (503, {})])
def test_litellm_goes_direct_when_gateway_is_down(monkeypatch, provider, status, body):
    server, gateway = _gateway(monkeypatch, status, body)
    model = make_model("deep_research_agent", "reasoning")

    assert _ask(model, model.model) == "pong"
    assert gateway  # tried the gateway first
    (call,) = provider
    assert call["headers"]["authorization"] == "Bearer sk-or-direct"
    assert call["body"]["model"] == "deepseek/deepseek-v4.1-flash"
    assert call["body"]["reasoning"] == {"effort": "medium"}
    assert "metadata" not in call["body"]  # proxy-only tags stay off OpenRouter
    server.shutdown()


def test_litellm_goes_direct_when_gateway_is_unreachable(monkeypatch, provider):
    server, _ = _gateway(monkeypatch, 200, None)
    server.shutdown()
    server.server_close()  # nothing listens on the port any more
    model = make_model("deep_research_agent")

    assert _ask(model, model.model) == "pong"
    assert len(provider) == 1


def test_gemini_goes_direct_when_gateway_is_down(monkeypatch, provider):
    server, gateway = _gateway(monkeypatch, 404, RAILWAY_NOT_FOUND)
    model = make_gemini("data_analyst_agent", "gemini-2.5-flash")

    assert _ask(model, "gemini-2.5-flash") == "pong"
    assert gateway
    (call,) = provider
    assert ":generateContent" in call["path"]
    assert call["headers"]["x-goog-api-key"] == "real-gemini-key"
    server.shutdown()


def test_down_gateway_is_skipped_for_a_while(monkeypatch, provider):
    server, gateway = _gateway(monkeypatch, 404, RAILWAY_NOT_FOUND)
    model = make_model("deep_research_agent")

    _ask(model, model.model)
    _ask(model, model.model)
    assert len(gateway) == 1  # the second call didn't wait on the gateway
    assert len(provider) == 2

    monkeypatch.setattr(model_factory, "_gateway_down_until", 0.0)
    _ask(model, model.model)
    assert len(gateway) == 2  # retried once the pause is over
    server.shutdown()


@pytest.mark.parametrize("status", [401, 429])
def test_gateway_refusals_are_not_bypassed(monkeypatch, provider, status):
    """Bad keys and spent budgets are the gateway doing its job, not an outage."""
    server, _ = _gateway(monkeypatch, status, {"error": {"message": "no"}})
    model = make_model("deep_research_agent")

    with pytest.raises(Exception):
        _ask(model, model.model)
    assert provider == []
    server.shutdown()
