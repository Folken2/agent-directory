# State Management Patterns

## Overview

ADK has two different state update mechanisms depending on where you are in the code:

| Context | Method | Why |
|---------|--------|-----|
| Callbacks (`CallbackContext`) | Direct modification: `callback_context.state["key"] = value` | Callbacks run within an existing event's lifecycle |
| BaseAgent subclasses | `EventActions(state_delta={"key": value})` | Events are the source of truth; state is derived from deltas |
| Tool functions (`ToolContext`) | Direct modification: `tool_context.state["key"] = value` | Tools run within a tool-call event |

## Pattern 1: State in Callbacks

Direct modification is safe and recommended in callbacks.

```python
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse


def tracking_callback(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> LlmResponse | None:
    """Track LLM call count in state."""
    count = callback_context.state.get("llm_call_count", 0)
    callback_context.state["llm_call_count"] = count + 1
    callback_context.state["last_request_length"] = len(str(llm_request.contents))
    return None
```

## Pattern 2: State in BaseAgent (EventActions.state_delta)

When subclassing `BaseAgent`, you **must** use `EventActions.state_delta` to update state. The event system replays deltas to reconstruct state — direct modifications are not captured.

```python
from typing import AsyncGenerator
from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.genai.types import Content, Part


class CounterAgent(BaseAgent):
    """Increments a counter each time it runs."""

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        current = ctx.session.state.get("counter", 0)
        new_value = current + 1

        # CORRECT: use state_delta
        yield Event(
            author=self.name,
            content=Content(parts=[Part(text=f"Counter is now {new_value}")]),
            actions=EventActions(
                state_delta={"counter": new_value},
            ),
        )


class MultiStateAgent(BaseAgent):
    """Update multiple state keys in a single event."""

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        yield Event(
            author=self.name,
            content=Content(parts=[Part(text="Initialised workflow state.")]),
            actions=EventActions(
                state_delta={
                    "workflow_status": "running",
                    "step": 1,
                    "errors": [],
                    "started_at": "2025-01-01T00:00:00Z",
                },
            ),
        )
```

### Common Mistake

```python
# WRONG — in a BaseAgent subclass
async def _run_async_impl(self, ctx):
    ctx.session.state["counter"] = 42  # This change may be LOST
    yield Event(...)

# CORRECT — use state_delta
async def _run_async_impl(self, ctx):
    yield Event(
        ...,
        actions=EventActions(state_delta={"counter": 42}),
    )
```

## Pattern 3: output_key for Simple State Updates

`output_key` on an `LlmAgent` automatically stores the agent's final text response in state under that key. This is the simplest way to pass data between agents in a `SequentialAgent`.

```python
from google.adk.agents import LlmAgent, SequentialAgent

planner = LlmAgent(
    name="planner",
    model="gemini-2.0-flash",
    instruction="Generate a detailed plan for the user's request.",
    output_key="plan",  # LLM response stored in state["plan"]
)

reviewer = LlmAgent(
    name="reviewer",
    model="gemini-2.0-flash",
    instruction="Review the plan in state['plan'] and provide feedback.",
    output_key="review",  # LLM response stored in state["review"]
)

executor = LlmAgent(
    name="executor",
    model="gemini-2.0-flash",
    instruction=(
        "Execute the plan from state['plan'], "
        "incorporating feedback from state['review']."
    ),
)

pipeline = SequentialAgent(
    name="plan_review_execute",
    sub_agents=[planner, reviewer, executor],
)
```

## State Prefixes

| Prefix | Scope | Persistence | Example |
|--------|-------|-------------|---------|
| *(none)* | Session | Until session ends | `state["results"]` |
| `app:` | Application | Across all sessions | `state["app:api_key"]` |
| `user:` | User | Across user's sessions | `state["user:language"]` |
| `temp:` | Temporary | Current turn only | `state["temp:scratch"]` |

### When to Use Each

```python
# Session state (default) — conversation-specific data
tool_context.state["search_results"] = results
tool_context.state["conversation_topic"] = "weather"

# App state — configuration shared across all users
tool_context.state["app:max_retries"] = 3
tool_context.state["app:api_base_url"] = "https://api.example.com"

# User state — preferences that persist across conversations
tool_context.state["user:preferred_language"] = "es"
tool_context.state["user:timezone"] = "America/New_York"

# Temp state — scratch space, not persisted
tool_context.state["temp:intermediate_calculation"] = partial_result
tool_context.state["temp:retry_count"] = 0
```

## Reading State in Instructions

Agent instructions can reference state values using curly braces. ADK substitutes them at runtime.

```python
agent = LlmAgent(
    name="personalised_agent",
    model="gemini-2.0-flash",
    instruction=(
        "You are helping {user:name} with their request. "
        "Their preferred language is {user:language}. "
        "The current plan is: {plan}"
    ),
)
```

## State in Multi-Agent Systems

In a `SequentialAgent`, all sub-agents share the same session state. This is the primary mechanism for passing data between agents.

```python
# Agent A writes state
tool_context.state["analysis_result"] = {"score": 85, "issues": [...]}

# Agent B reads it (via instruction template or tool)
# instruction: "Review the analysis: {analysis_result}"
```

In agent transfer (via `tool_context.actions.transfer_to_agent`), state is also shared because the session is the same.

## Defensive State Access

Always use `.get()` with defaults to avoid KeyError:

```python
# GOOD
count = tool_context.state.get("counter", 0)
items = tool_context.state.get("items", [])
config = tool_context.state.get("app:config", {})

# BAD — may raise KeyError
count = tool_context.state["counter"]
```
