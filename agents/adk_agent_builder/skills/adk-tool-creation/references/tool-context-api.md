# ToolContext API Reference

`ToolContext` is passed as the last parameter to every ADK function tool. It provides access to session state, action controls, and artifact management.

Import:
```python
from google.adk.tools.tool_context import ToolContext
```

## 1. State — `tool_context.state`

Read and write session state. State persists across turns within a session.

```python
def my_tool(query: str, tool_context: ToolContext) -> dict:
    # Read state
    counter = tool_context.state.get("call_count", 0)

    # Write state
    tool_context.state["call_count"] = counter + 1
    tool_context.state["last_query"] = query

    return {"status": "success", "call_number": counter + 1}
```

### State Key Prefixes

| Prefix | Scope | Description |
|--------|-------|-------------|
| `app:` | Application | Shared across all users/sessions of the app |
| `user:` | User | Shared across all sessions for a specific user |
| *(no prefix)* | Session | Default; scoped to the current session |
| `temp:` | Temporary | Not persisted; cleared after the turn |

```python
# Application-wide config
tool_context.state["app:api_version"] = "v2"

# User preferences
tool_context.state["user:preferred_language"] = "es"

# Session scratch
tool_context.state["search_results"] = results

# Temporary (not persisted)
tool_context.state["temp:intermediate_calc"] = 42
```

## 2. Actions — `tool_context.actions`

Control agent behaviour from within a tool.

### `tool_context.actions.escalate`

Signal that the tool needs to escalate — in a `LoopAgent`, this exits the loop early.

```python
def approve_and_escalate(decision: str, tool_context: ToolContext) -> dict:
    """Approve the plan and escalate to the parent agent."""
    tool_context.state["plan_approved"] = True
    tool_context.actions.escalate = True
    return {"status": "success", "message": "Plan approved, escalating."}
```

### `tool_context.actions.skip_summarization`

Prevent the LLM from summarising the tool result. Useful when the tool returns pre-formatted content that should be passed through verbatim.

```python
def get_raw_report(report_id: str, tool_context: ToolContext) -> dict:
    """Return a pre-formatted report without LLM summarisation."""
    report = _fetch_report(report_id)
    tool_context.actions.skip_summarization = True
    return {"status": "success", "data": report}
```

### `tool_context.actions.transfer_to_agent`

Transfer control to another agent in a multi-agent setup.

```python
def hand_off_to_specialist(reason: str, tool_context: ToolContext) -> dict:
    """Transfer the conversation to the specialist agent."""
    tool_context.actions.transfer_to_agent = "specialist_agent"
    return {"status": "success", "message": f"Transferring: {reason}"}
```

## 3. Artifacts

Store and retrieve binary or text artifacts (files, images, etc.) that persist in the session.

### Save an artifact

```python
import google.genai.types as types


def save_report(title: str, content: str, tool_context: ToolContext) -> dict:
    """Generate and save a report as an artifact."""
    try:
        artifact = types.Part.from_text(text=content)
        version = tool_context.save_artifact(
            filename=f"{title}.md",
            artifact=artifact,
        )
        return {
            "status": "success",
            "message": f"Saved artifact '{title}.md' (version {version})",
        }
    except Exception as e:
        return {"status": "error", "error": f"Failed to save artifact: {e}"}
```

### Load an artifact

```python
def load_report(filename: str, tool_context: ToolContext) -> dict:
    """Load a previously saved artifact."""
    try:
        artifact = tool_context.load_artifact(filename=filename)
        if artifact is None:
            return {"status": "error", "error": f"Artifact '{filename}' not found"}
        return {"status": "success", "data": artifact.text}
    except Exception as e:
        return {"status": "error", "error": f"Failed to load artifact: {e}"}
```

### List artifacts

```python
def list_artifacts(tool_context: ToolContext) -> dict:
    """List all saved artifacts in the current session."""
    try:
        filenames = tool_context.list_artifacts()
        return {"status": "success", "data": filenames}
    except Exception as e:
        return {"status": "error", "error": f"Failed to list artifacts: {e}"}
```

## 4. Function ID and Invocation Metadata

```python
def debug_tool(tool_context: ToolContext) -> dict:
    """Return metadata about this tool invocation for debugging."""
    return {
        "status": "success",
        "function_call_id": tool_context.function_call_id,
    }
```

## Summary Table

| Property / Method | Type | Description |
|---|---|---|
| `state` | `dict`-like | Read/write session state |
| `actions.escalate` | `bool` | Exit LoopAgent early |
| `actions.skip_summarization` | `bool` | Skip LLM summary of result |
| `actions.transfer_to_agent` | `str` | Transfer to named agent |
| `save_artifact(filename, artifact)` | `int` | Save artifact, returns version |
| `load_artifact(filename)` | `Part \| None` | Load artifact by filename |
| `list_artifacts()` | `list[str]` | List artifact filenames |
| `function_call_id` | `str` | Unique ID for this invocation |
