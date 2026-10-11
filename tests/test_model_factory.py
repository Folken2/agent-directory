import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from google.adk.models.google_llm import Gemini
from google.adk.models.lite_llm import LiteLlm
from google.adk.models.llm_request import LlmRequest
from google.genai import types
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


@pytest.fixture
def proxy(monkeypatch):
    """A stand-in LiteLLM proxy that records each request it receives."""
    seen = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            seen.append(
                {
                    "path": self.path,
                    "headers": {k.lower(): v for k, v in self.headers.items()},
                    "body": json.loads(body or b"{}"),
                }
            )
            reply = GEMINI_REPLY if self.path.startswith("/gemini/") else CHAT_REPLY
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setenv("LITELLM_PROXY_URL", f"http://127.0.0.1:{server.server_port}")
    yield seen
    server.shutdown()


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for var in (
        "LITELLM_PROXY_URL",
        "LITELLM_PROXY_API_KEY",
        "LITELLM_KEY_DEEP_RESEARCH_AGENT",
        "LITELLM_KEY_DATA_ANALYST_AGENT",
        "FAST_MODEL",
        "REASONING_MODEL",
    ):
        monkeypatch.delenv(var, raising=False)


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
    assert model.model == "openrouter/google/gemini-3-flash-preview"
    assert make_model("deep_research_agent", "reasoning").model == (
        "openrouter/google/gemini-3-pro-preview"
    )
    assert make_gemini("data_analyst_agent", "gemini-2.5-flash") == "gemini-2.5-flash"


def test_tier_env_override(monkeypatch):
    monkeypatch.setenv("FAST_MODEL", "openrouter/acme/fast")
    assert make_model("deep_research_agent").model == "openrouter/acme/fast"


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
    assert call["body"]["model"] == "openrouter/google/gemini-3-pro-preview"
    assert call["body"]["metadata"]["tags"] == [
        "agent:deep_research_agent",
        "tier:reasoning",
    ]


def test_proxied_litellm_falls_back_to_shared_key(proxy, monkeypatch):
    monkeypatch.setenv("LITELLM_PROXY_API_KEY", "sk-shared")
    model = make_model("deep_research_agent")

    assert _ask(model, model.model) == "pong"
    assert proxy[0]["headers"]["authorization"] == "Bearer sk-shared"


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
