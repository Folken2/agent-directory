# Callback Signatures — Complete Reference

## Critical: Parameter Names Must Be Exact

ADK uses keyword matching to inject callback parameters. **Wrong parameter names cause silent failures** — your callback will receive `None` or not be called at all.

## before_model_callback

### CORRECT

```python
from typing import Any
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse
from google.genai.types import Content, Part


def before_model_callback(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> LlmResponse | None:
    """Called before every LLM invocation.

    Args:
        callback_context: Provides access to state and agent info.
        llm_request: The request about to be sent to the LLM.

    Returns:
        None to proceed normally, or LlmResponse to short-circuit.
    """
    return None
```

### WRONG — Do Not Use These Parameter Names

```python
# WRONG: 'ctx' instead of 'callback_context'
def before_model_callback(ctx, llm_request):  # BROKEN
    ...

# WRONG: 'request' instead of 'llm_request'
def before_model_callback(callback_context, request):  # BROKEN
    ...

# WRONG: 'context' instead of 'callback_context'
def before_model_callback(context, llm_request):  # BROKEN
    ...
```

### Short-Circuit Example

Return an `LlmResponse` to skip the LLM entirely:

```python
def cached_response_callback(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> LlmResponse | None:
    """Return a cached response if available."""
    cache_key = llm_request.contents[-1].parts[0].text[:100]
    cached = callback_context.state.get(f"cache:{cache_key}")
    if cached:
        return LlmResponse(
            content=Content(parts=[Part(text=cached)])
        )
    return None
```

## after_model_callback

### CORRECT

```python
def after_model_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
    """Called after every LLM response.

    Args:
        callback_context: Provides access to state and agent info.
        llm_response: The response from the LLM.

    Returns:
        None to use the original response, or LlmResponse to override.
    """
    return None
```

### WRONG

```python
# WRONG: 'response' instead of 'llm_response'
def after_model_callback(callback_context, response):  # BROKEN
    ...

# WRONG: 'result' instead of 'llm_response'
def after_model_callback(callback_context, result):  # BROKEN
    ...
```

### Response Modification Example

```python
def add_disclaimer(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
    """Append a disclaimer to every response."""
    if llm_response.content and llm_response.content.parts:
        for part in llm_response.content.parts:
            if hasattr(part, "text") and part.text:
                part.text += "\n\n---\n*This is AI-generated content.*"
    return llm_response
```

## before_tool_callback

### CORRECT

```python
from google.adk.tools import BaseTool


def before_tool_callback(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext,
) -> dict | None:
    """Called before a tool executes.

    Args:
        tool: The tool about to be called.
        args: The arguments the LLM is passing to the tool.
        tool_context: Provides access to state (note: type is CallbackContext).

    Returns:
        None to allow the tool to run, or dict to skip and use as result.
    """
    return None
```

### WRONG

```python
# WRONG: 'tool_name' instead of 'tool'
def before_tool_callback(tool_name, args, tool_context):  # BROKEN
    ...

# WRONG: 'params' instead of 'args'
def before_tool_callback(tool, params, tool_context):  # BROKEN
    ...

# WRONG: 'callback_context' instead of 'tool_context'
def before_tool_callback(tool, args, callback_context):  # BROKEN
    ...
```

**Important**: In `before_tool_callback` and `after_tool_callback`, the third parameter is named `tool_context` (not `callback_context`), even though the type is `CallbackContext`.

### Tool Blocking Example

```python
DANGEROUS_TOOLS = {"delete_file", "drop_table", "send_email"}

def block_dangerous_tools(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext,
) -> dict | None:
    """Block dangerous tools unless explicitly approved."""
    if tool.name in DANGEROUS_TOOLS:
        approved = tool_context.state.get("approved_tools", [])
        if tool.name not in approved:
            return {
                "status": "blocked",
                "error": f"Tool '{tool.name}' requires approval. "
                         f"Set approved_tools in state to allow it.",
            }
    return None
```

## after_tool_callback

### CORRECT

```python
def after_tool_callback(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext,
    result: dict,
) -> dict | None:
    """Called after a tool executes.

    Args:
        tool: The tool that was called.
        args: The arguments that were passed.
        tool_context: Provides access to state.
        result: The tool's return value.

    Returns:
        None to use the original result, or dict to override.
    """
    return None
```

### WRONG

```python
# WRONG: 'output' instead of 'result'
def after_tool_callback(tool, args, tool_context, output):  # BROKEN
    ...

# WRONG: 'response' instead of 'result'
def after_tool_callback(tool, args, tool_context, response):  # BROKEN
    ...
```

### Result Enrichment Example

```python
import time

def add_timing(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext,
    result: dict,
) -> dict | None:
    """Add execution metadata to tool results."""
    if isinstance(result, dict):
        result["_metadata"] = {
            "tool_name": tool.name,
            "timestamp": time.time(),
        }
        return result
    return None
```

## Summary Table

| Callback | Parameters | Return to Override | Return to Proceed |
|----------|-----------|-------------------|------------------|
| `before_model_callback` | `callback_context`, `llm_request` | `LlmResponse` | `None` |
| `after_model_callback` | `callback_context`, `llm_response` | `LlmResponse` | `None` |
| `before_tool_callback` | `tool`, `args`, `tool_context` | `dict` | `None` |
| `after_tool_callback` | `tool`, `args`, `tool_context`, `result` | `dict` | `None` |
