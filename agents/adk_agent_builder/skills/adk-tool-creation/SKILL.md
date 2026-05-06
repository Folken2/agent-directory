---
name: adk-tool-creation
description: >-
  Building Google ADK function tools — ToolContext usage, proper signatures,
  error handling, return formats, type hints, and async patterns. Load this
  skill when creating custom tools for an agent.
---

# ADK Tool Creation

## Core Rules

1. Every tool is a plain Python function wrapped in `FunctionTool`.
2. Required signature pattern:
   ```python
   def my_tool(param1: str, param2: int, tool_context: ToolContext) -> dict:
   ```
3. Always return a `dict` with at minimum `"status"` and either `"message"` or `"data"` keys.
4. Handle errors gracefully — return `{"status": "error", "error": "description"}`. **Never raise exceptions** from a tool; the framework cannot recover from them gracefully.
5. Write a clear, specific docstring. The LLM reads the docstring to decide **when** and **how** to call the tool. Include:
   - A one-line summary of what the tool does.
   - An `Args:` section with each parameter described.
   - A `Returns:` section describing the response shape.
6. Use type hints for **every** parameter — the framework inspects them to build the tool schema sent to the model.
7. Access session state via `tool_context.state["key"]` for reading and writing.
8. To escalate (exit a LoopAgent early): `tool_context.actions.escalate = True`.
9. To skip LLM summarisation of the tool result: `tool_context.actions.skip_summarization = True`.
10. Wrap the function: `my_tool_instance = FunctionTool(func=my_tool)`.

## Quick-Start Template

```python
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


def do_something(query: str, tool_context: ToolContext) -> dict:
    """One-line summary of what this tool does.

    Args:
        query: Description of the query parameter.

    Returns:
        A dict with status and result data.
    """
    try:
        # ... implementation ...
        result = {"answer": "42"}
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "error": str(e)}


do_something_tool = FunctionTool(func=do_something)
```

## Parameter Guidelines

- Use `str`, `int`, `float`, `bool`, `list[str]`, `dict[str, Any]` — keep types JSON-serialisable.
- `tool_context` is **always the last parameter** and is injected by the framework (never supplied by the model).
- Optional parameters: use `param: str = "default"`. The model can omit them.
- Avoid `*args` / `**kwargs` — the framework cannot generate a schema for them.

## Return Format Convention

```python
# Success
{"status": "success", "message": "Created item #42", "data": {...}}

# Error
{"status": "error", "error": "Item not found"}

# Partial / warning
{"status": "warning", "message": "Created but with issues", "warnings": [...]}
```

## Registering Tools on an Agent

```python
from google.adk.agents import LlmAgent

agent = LlmAgent(
    name="my_agent",
    model="gemini-2.0-flash",
    instruction="You are a helpful assistant.",
    tools=[do_something_tool],
)
```

## References

- Load `tool-patterns` for complete CRUD, API wrapper, file-ops, and search tool implementations.
- Load `tool-context-api` for the full ToolContext API reference (state, actions, artifacts).
- Load `async-tool-examples` for async tool patterns with `aiohttp`, `asyncpg`, etc.
