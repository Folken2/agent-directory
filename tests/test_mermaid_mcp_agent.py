import asyncio
import importlib

from mermaid_mcp_agent.config import utils


def _load_agent_module(monkeypatch, api_key):
    if api_key is None:
        monkeypatch.delenv("MERMAID_CHART_API_KEY", raising=False)
    else:
        monkeypatch.setenv("MERMAID_CHART_API_KEY", api_key)
    import mermaid_mcp_agent.agent as agent_module

    return importlib.reload(agent_module)


def test_mcp_sends_bearer_token_from_env(monkeypatch):
    agent_module = _load_agent_module(monkeypatch, "  secret-token \n")
    params = agent_module.root_agent.tools[0]._connection_params
    assert params.headers == {"Authorization": "Bearer secret-token"}


def test_mcp_sends_no_auth_header_without_key(monkeypatch):
    agent_module = _load_agent_module(monkeypatch, None)
    params = agent_module.root_agent.tools[0]._connection_params
    assert not params.headers


class _FakeTool:
    def __init__(self, name):
        self.name = name
        self.description = f"{name} description"


class McpToolset:
    """Stand-in matched by class name, like the real ADK McpToolset."""

    def __init__(self, tools=None, error=None):
        self._tools = tools or []
        self._error = error

    async def get_tools(self):
        if self._error:
            raise self._error
        return self._tools


class _FakeAgent:
    def __init__(self, tools):
        self.name = "mermaid_mcp_agent"
        self.tools = tools
        self.instruction = "Base prompt."


class _FakeContext:
    def __init__(self, agent):
        self.state = {}
        self._invocation_context = type("Inv", (), {"agent": agent})()


def _run_callback(toolset):
    agent = _FakeAgent([toolset])
    result = asyncio.run(utils.before_agent_callback_update_tools(_FakeContext(agent)))
    return agent, result


def _reply_text(content):
    return "".join(part.text or "" for part in content.parts)


def test_callback_replies_visibly_when_mcp_auth_fails(monkeypatch):
    monkeypatch.delenv("MERMAID_CHART_API_KEY", raising=False)
    _, result = _run_callback(McpToolset(error=ConnectionError("401 Unauthorized")))
    assert result is not None
    assert result.role == "model"
    text = _reply_text(result)
    assert "Mermaid" in text
    assert "MERMAID_CHART_API_KEY" in text


def test_callback_reply_mentions_rejected_key_when_key_is_set(monkeypatch):
    monkeypatch.setenv("MERMAID_CHART_API_KEY", "bad")
    _, result = _run_callback(McpToolset(error=ConnectionError("401 Unauthorized")))
    assert result is not None
    assert "rejected" in _reply_text(result)


def test_callback_replies_visibly_when_mcp_returns_no_tools():
    _, result = _run_callback(McpToolset(tools=[]))
    assert result is not None
    assert "Mermaid" in _reply_text(result)


def test_callback_lets_agent_run_when_tools_load():
    agent, result = _run_callback(
        McpToolset(tools=[_FakeTool("validate_and_render_mermaid_diagram")])
    )
    assert result is None
    assert "validate_and_render_mermaid_diagram" in agent.instruction
