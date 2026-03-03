"""
ConsoleLoggerPlugin — Pretty terminal output for all ADK agents.

Prints color-coded sections for every lifecycle event:
agent start/end, LLM requests/responses, tool calls/results, errors.

Uses ANSI colors (auto-disabled when not supported).
"""

from __future__ import annotations

import os
import sys
import time
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

from google.genai import types

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.plugins.base_plugin import BasePlugin
from google.adk.tools.base_tool import BaseTool

if TYPE_CHECKING:
    from google.adk.agents.invocation_context import InvocationContext
    from google.adk.tools.tool_context import ToolContext
    from google.adk.events.event import Event


# ── ANSI colors ─────────────────────────────────────────────────────

def _supports_color() -> bool:
    if os.getenv("NO_COLOR"):
        return False
    if os.getenv("FORCE_COLOR"):
        return True
    return hasattr(sys.stderr, "isatty") and sys.stderr.isatty()


_COLOR = _supports_color()


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOR else text


def _dim(t: str) -> str:      return _c("2", t)
def _bold(t: str) -> str:     return _c("1", t)
def _green(t: str) -> str:    return _c("32", t)
def _red(t: str) -> str:      return _c("31", t)
def _yellow(t: str) -> str:   return _c("33", t)
def _cyan(t: str) -> str:     return _c("36", t)
def _blue(t: str) -> str:     return _c("34", t)
def _magenta(t: str) -> str:  return _c("35", t)
def _white(t: str) -> str:    return _c("97", t)


# ── Formatting helpers ──────────────────────────────────────────────

_W = 70  # line width


def _supports_unicode() -> bool:
    try:
        encoding = sys.stderr.encoding or "ascii"
        "\u2500\u2501\u2502\u25b8\u25c7\u25c6\u2714\u2718\u26a1".encode(encoding)
        return True
    except (UnicodeEncodeError, LookupError):
        return False


_UNICODE = _supports_unicode()

_CH_HLINE = "\u2500" if _UNICODE else "-"
_CH_HLINE_BOLD = "\u2501" if _UNICODE else "="
_CH_VLINE = "\u2502" if _UNICODE else "|"
_CH_ARROW_R = "\u25b8" if _UNICODE else ">"
_CH_DIAMOND_O = "\u25c7" if _UNICODE else "o"
_CH_DIAMOND_F = "\u25c6" if _UNICODE else "*"
_CH_CHECK = "\u2714" if _UNICODE else "+"
_CH_CROSS = "\u2718" if _UNICODE else "x"
_CH_BOLT = "\u26a1" if _UNICODE else "#"


def _hr(char: str | None = None) -> str:
    if char is None:
        char = _CH_HLINE
    return char * _W


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _ms(seconds: float) -> str:
    ms = round(seconds * 1000)
    if ms < 1000:
        return f"{ms}ms"
    return f"{ms / 1000:.1f}s"


def _truncate(text: str, max_len: int = 120) -> str:
    text = str(text).replace("\n", " ")
    if len(text) <= max_len:
        return text
    return text[:max_len] + "\u2026"


def _format_args(args: dict[str, Any], indent: int = 5, max_keys: int = 4) -> str:
    lines = []
    prefix = " " * indent
    items = list(args.items())
    for k, v in items[:max_keys]:
        val = _truncate(str(v), 90)
        lines.append(f"{prefix}{_dim(k + ':')} {val}")
    if len(items) > max_keys:
        lines.append(f"{prefix}{_dim(f'... +{len(items) - max_keys} more')}")
    return "\n".join(lines)


def _out(*parts: str) -> None:
    try:
        print(*parts, file=sys.stderr, flush=True)
    except UnicodeEncodeError:
        safe = " ".join(parts).encode(sys.stderr.encoding or "ascii", errors="replace").decode()
        print(safe, file=sys.stderr, flush=True)


# ── Plugin ──────────────────────────────────────────────────────────


class ConsoleLoggerPlugin(BasePlugin):
    """Pretty-prints all agent lifecycle events to the terminal."""

    def __init__(self) -> None:
        super().__init__(name="console_logger")
        self._run_start: float = 0
        self._tool_count: int = 0
        self._llm_count: int = 0
        self._current_agent: str = ""

    # ── Run lifecycle ───────────────────────────────────────────────

    async def before_run_callback(
        self, *, invocation_context: InvocationContext
    ) -> Optional[types.Content]:
        self._run_start = time.time()
        self._tool_count = 0
        self._llm_count = 0

        session_id = invocation_context.session.id if invocation_context.session else "?"
        short_id = session_id[:8] if len(session_id) > 8 else session_id
        agent_name = getattr(invocation_context.agent, "name", "?")

        _out("")
        _out(_dim(_hr(_CH_HLINE_BOLD)))
        _out(
            f"  {_bold(_green(f'{_CH_ARROW_R} AGENT RUN'))}"
            f"  {_dim(_CH_VLINE)}  {_magenta(agent_name)}"
            f"  {_dim(_CH_VLINE)}  session: {_cyan(short_id)}"
            f"  {_dim(_CH_VLINE)}  {_dim(_ts())}"
        )
        _out(_dim(_hr(_CH_HLINE_BOLD)))
        return None

    async def after_run_callback(
        self, *, invocation_context: InvocationContext
    ) -> None:
        elapsed = time.time() - self._run_start if self._run_start else 0

        _out("")
        _out(_dim(_hr(_CH_HLINE_BOLD)))
        _out(
            f"  {_bold(_green(f'{_CH_CHECK} DONE'))}"
            f"  {_dim(_CH_VLINE)}  tools: {_white(str(self._tool_count))}"
            f"  {_dim(_CH_VLINE)}  llm calls: {_white(str(self._llm_count))}"
            f"  {_dim(_CH_VLINE)}  {_white(_ms(elapsed))}"
            f"  {_dim(_CH_VLINE)}  {_dim(_ts())}"
        )
        _out(_dim(_hr(_CH_HLINE_BOLD)))
        _out("")

    # ── Agent lifecycle ─────────────────────────────────────────────

    async def before_agent_callback(
        self, *, agent: BaseAgent, callback_context: CallbackContext
    ) -> Optional[types.Content]:
        self._current_agent = agent.name
        _out(f"\n  {_magenta(_CH_ARROW_R)} {_bold('Agent')}: {_magenta(agent.name)}")
        return None

    async def after_agent_callback(
        self, *, agent: BaseAgent, callback_context: CallbackContext
    ) -> Optional[types.Content]:
        return None

    # ── LLM lifecycle ───────────────────────────────────────────────

    async def before_model_callback(
        self, *, callback_context: CallbackContext, llm_request: LlmRequest
    ) -> Optional[LlmResponse]:
        self._llm_count += 1
        model = llm_request.model or "unknown"
        short_model = model.rsplit("/", 1)[-1] if "/" in model else model
        n_contents = len(llm_request.contents) if llm_request.contents else 0
        n_tools = len(llm_request.tools_dict) if llm_request.tools_dict else 0

        _out(
            f"  {_blue(_CH_DIAMOND_O)} {_bold('LLM Request')} {_dim('->')} {_blue(short_model)}"
            f"  {_dim(f'[{n_contents} msgs, {n_tools} tools]')}"
        )
        return None

    async def after_model_callback(
        self, *, callback_context: CallbackContext, llm_response: LlmResponse
    ) -> Optional[LlmResponse]:
        parts_info = ""
        if llm_response.content and llm_response.content.parts:
            parts = llm_response.content.parts
            n_text = sum(1 for p in parts if p.text)
            n_fc = sum(1 for p in parts if p.function_call)
            parts_info = _dim(f"[{n_text} text, {n_fc} tool_calls]")

        turn = ""
        if llm_response.turn_complete:
            turn = _green(" (final)")

        _out(
            f"  {_blue(_CH_DIAMOND_F)} {_bold('LLM Response')} {_dim('<-')} {_blue(self._current_agent)}"
            f"{turn}  {parts_info}"
        )
        return None

    async def on_model_error_callback(
        self,
        *,
        callback_context: CallbackContext,
        llm_request: LlmRequest,
        error: Exception,
    ) -> Optional[LlmResponse]:
        model = (llm_request.model or "unknown").rsplit("/", 1)[-1]
        _out(
            f"  {_red(_CH_CROSS)} {_bold('LLM Error')} {_dim('->')} {_red(model)}"
            f"\n     {_red(_truncate(str(error), 200))}"
        )
        return None

    # ── Tool lifecycle ──────────────────────────────────────────────

    async def before_tool_callback(
        self,
        *,
        tool: BaseTool,
        tool_args: dict[str, Any],
        tool_context: ToolContext,
    ) -> Optional[dict]:
        _out(f"\n  {_yellow(_CH_BOLT)} {_bold('Tool Call')} {_dim('->')} {_cyan(tool.name)}")
        if tool_args:
            _out(_format_args(tool_args))
        return None

    async def after_tool_callback(
        self,
        *,
        tool: BaseTool,
        tool_args: dict[str, Any],
        tool_context: ToolContext,
        result: dict,
    ) -> Optional[dict]:
        self._tool_count += 1
        is_error = isinstance(result, dict) and result.get("status") == "error"

        if is_error:
            error_msg = result.get("error") or result.get("message") or str(result)
            _out(
                f"  {_red(_CH_CROSS)} {_bold('Tool Error')} {_dim('->')} {_cyan(tool.name)}"
                f"\n     {_red(_truncate(str(error_msg), 200))}"
            )
        else:
            preview = ""
            if isinstance(result, dict):
                msg = result.get("message") or result.get("result") or result.get("output")
                if msg:
                    preview = f"\n     {_dim(_truncate(str(msg), 160))}"

            _out(
                f"  {_green(_CH_CHECK)} {_bold('Tool Done')} {_dim('->')} {_cyan(tool.name)}"
                f"  {_green('OK')}{preview}"
            )
        return None

    async def on_tool_error_callback(
        self,
        *,
        tool: BaseTool,
        tool_args: dict[str, Any],
        tool_context: ToolContext,
        error: Exception,
    ) -> Optional[dict]:
        _out(
            f"  {_red(_CH_CROSS)} {_bold('Tool Exception')} {_dim('->')} {_cyan(tool.name)}"
            f"\n     {_red(_truncate(str(error), 200))}"
        )
        return None

    # ── Event callback ──────────────────────────────────────────────

    async def on_event_callback(
        self, *, invocation_context: InvocationContext, event: Event
    ) -> Optional[Event]:
        return None


# Singleton instance — imported by __init__.py and referenced by run_adk.py
console_logger_plugin = ConsoleLoggerPlugin()
