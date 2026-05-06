---
name: adk-callbacks-hitl
description: >-
  ADK callback signatures, HITL approval gates, and state management —
  exact parameter names, before/after hooks, EventActions.state_delta,
  and defensive HITL patterns. Load this skill when adding callbacks or
  approval gates to an agent.
---

# ADK Callbacks and Human-in-the-Loop

## Critical Rule: Exact Parameter Names

ADK callbacks use **keyword argument matching**. The framework inspects parameter names to inject the correct objects. Using wrong parameter names causes silent failures.

## Callback Signatures

### before_model_callback

Called before every LLM call. Return `None` to proceed normally, or return an `LlmResponse` to short-circuit the LLM call.

```python
from google.adk.agents.callback_context import CallbackContext
from google.genai.types import Content, Part
from google.adk.models import LlmRequest, LlmResponse

def before_model_callback(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> LlmResponse | None:
    # Return None → proceed with LLM call
    # Return LlmResponse → skip the LLM call, use this response instead
    return None
```

### after_model_callback

Called after every LLM response. Return `None` to use the original response, or return a modified `LlmResponse`.

```python
def after_model_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
    # Inspect or modify the response
    return None  # Use original response
```

### before_tool_callback

Called before a tool executes. Return `None` to allow the tool to run, or return a `dict` to skip the tool and use the dict as the result.

```python
from google.adk.tools import BaseTool

def before_tool_callback(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext,
) -> dict | None:
    # Return None → tool runs normally
    # Return dict → tool is skipped, dict is used as result
    return None
```

### after_tool_callback

Called after a tool executes. Return `None` to use the original result, or return a modified `dict`.

```python
def after_tool_callback(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext,
    result: dict,
) -> dict | None:
    return None  # Use original result
```

## Registering Callbacks on an Agent

```python
from google.adk.agents import LlmAgent

agent = LlmAgent(
    name="guarded_agent",
    model="gemini-2.0-flash",
    instruction="You are a helpful assistant.",
    before_model_callback=my_before_model_cb,
    after_model_callback=my_after_model_cb,
    before_tool_callback=my_before_tool_cb,
    after_tool_callback=my_after_tool_cb,
)
```

## Common Callback Patterns

### Input Guardrail (before_model_callback)

Block harmful or off-topic requests before they reach the LLM:

```python
BLOCKED_TOPICS = ["illegal", "harmful", "exploit"]

def input_guardrail(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> LlmResponse | None:
    last_message = llm_request.contents[-1].parts[0].text.lower()
    for topic in BLOCKED_TOPICS:
        if topic in last_message:
            return LlmResponse(
                content=Content(parts=[Part(text="I cannot help with that topic.")])
            )
    return None
```

### Tool Approval Gate (before_tool_callback)

Require approval before dangerous tools execute — see the `hitl-patterns` reference for the full implementation.

### Response Logging (after_model_callback)

```python
import logging
logger = logging.getLogger(__name__)

def log_responses(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
    for part in llm_response.content.parts:
        if hasattr(part, "text") and part.text:
            logger.info("[RESPONSE] %s", part.text[:200])
    return None
```

## State Management Rules

### In Callbacks: Direct Modification is Safe

```python
def my_callback(callback_context: CallbackContext, **kwargs):
    # This is safe in callbacks
    callback_context.state["counter"] = callback_context.state.get("counter", 0) + 1
```

### In BaseAgent Subclasses: Use EventActions.state_delta

When writing custom agents that subclass `BaseAgent`, you **must** use `state_delta` for state updates. Direct modification may be lost.

```python
from google.adk.events import EventActions

# CORRECT — in a BaseAgent subclass
actions = EventActions(state_delta={"counter": new_value})

# WRONG — in a BaseAgent subclass (changes may be lost)
# session.state["counter"] = new_value
```

### State Prefixes

| Prefix | Scope | Persisted | Use case |
|--------|-------|-----------|----------|
| *(none)* | Session | Yes | Default, per-session data |
| `app:` | Application | Yes | Shared config across all sessions |
| `user:` | User | Yes | Per-user preferences |
| `temp:` | Temporary | No | Scratch data, cleared after turn |

## References

- Load `callback-signatures` for every callback signature with WRONG vs CORRECT examples.
- Load `hitl-patterns` for complete HITL gate implementations including PlanApprovalGate.
- Load `state-management` for detailed state patterns and output_key usage.
