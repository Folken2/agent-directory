# State Placeholders in ADK Prompts

## Overview

ADK automatically replaces `{key}` placeholders in `instruction` strings with
values from `session.state`. This is the simplest form of dynamic prompts —
no InstructionProvider function needed.

## Basic Usage

```python
from google.adk.agents import LlmAgent

agent = LlmAgent(
    name="analyst",
    model="gemini-2.5-flash",
    instruction="""You are a data analyst for {company_name}.

Current user: {user_name}
Your current task: {current_task}

Analyze the data and provide insights.
""",
)
```

When ADK processes this instruction, it looks up `company_name`, `user_name`,
and `current_task` in the session state and substitutes their values. If a key
is missing from state, the placeholder remains as literal text `{key_name}`.

## Setting State Values

State can be set in multiple ways:

### 1. Initial session state

```python
from google.adk.sessions import InMemorySessionService

session_service = InMemorySessionService()
session = await session_service.create_session(
    app_name="my_app",
    user_id="user_123",
    state={
        "company_name": "Acme Corp",
        "user_name": "Alice",
        "user_role": "analyst",
    },
)
```

### 2. Tool functions writing to state

```python
from google.adk.tools.tool_context import ToolContext

def set_mode(mode: str, tool_context: ToolContext) -> dict:
    """Switch the agent's operating mode."""
    tool_context.state["mode"] = mode
    return {"status": "ok", "mode": mode}
```

### 3. output_key — automatic state from agent output

```python
planner = LlmAgent(
    name="planner",
    model="gemini-2.5-flash",
    instruction="Create a plan for: {user_request}",
    output_key="plan",  # Agent's response is stored as state["plan"]
)

executor = LlmAgent(
    name="executor",
    model="gemini-2.5-flash",
    instruction="Execute this plan: {plan}",  # Reads planner's output
    output_key="results",
)
```

The `output_key` parameter tells ADK to store the agent's final text response
into `session.state[output_key]`. This is the primary mechanism for passing
data between agents in SequentialAgent and LoopAgent.

## State Prefixes

ADK uses prefixes to control state scope and persistence:

### `user:` — User-scoped state

Persists across sessions for the same user. Good for preferences and profile.

```python
# Set in a tool
tool_context.state["user:preferred_language"] = "Spanish"
tool_context.state["user:timezone"] = "Europe/Madrid"

# Use in prompt
instruction = """
User language preference: {user:preferred_language}
User timezone: {user:timezone}
"""
```

### `app:` — Application-scoped state

Shared across all users of the application. Good for global config.

```python
# Set during app initialization
state["app:company_name"] = "Acme Corp"
state["app:max_query_rows"] = "10000"
state["app:support_email"] = "help@acme.com"

# Use in prompt
instruction = """You work for {app:company_name}.
For unresolved issues, direct users to {app:support_email}.
"""
```

### `temp:` — Temporary state

Cleared at the end of the current invocation. Good for intermediate values.

```python
# Set in a tool for the current turn only
tool_context.state["temp:intermediate_result"] = partial_data

# Use in prompt — only available during this invocation
instruction = "Intermediate data: {temp:intermediate_result}"
```

### No prefix — Session-scoped (default)

Standard session state. Persists for the duration of the session but not
across sessions.

```python
state["plan"] = "..."       # Session-scoped
state["findings"] = "..."   # Session-scoped
state["mode"] = "report"    # Session-scoped
```

## State in Multi-Agent Systems

### SequentialAgent — Chain via output_key

```python
from google.adk.agents import SequentialAgent, LlmAgent

step1 = LlmAgent(
    name="researcher",
    model="gemini-2.5-flash",
    instruction="Research the topic: {topic}",
    output_key="research",  # Writes to state["research"]
)

step2 = LlmAgent(
    name="writer",
    model="gemini-2.5-flash",
    instruction="Write an article based on: {research}",  # Reads state["research"]
    output_key="article",
)

step3 = LlmAgent(
    name="editor",
    model="gemini-2.5-flash",
    instruction="Edit and polish this article: {article}",  # Reads state["article"]
    output_key="final_article",
)

pipeline = SequentialAgent(
    name="article_pipeline",
    sub_agents=[step1, step2, step3],
)
```

### LoopAgent — Accumulate across iterations

```python
from google.adk.agents import LoopAgent, LlmAgent

researcher = LlmAgent(
    name="researcher",
    model="gemini-2.5-flash",
    instruction="""Research the topic: {topic}

Previous findings (build on these, don't repeat):
{findings}

Add new information to the findings.
""",
    output_key="findings",  # Overwrites each iteration with accumulated data
)

reviewer = LlmAgent(
    name="reviewer",
    model="gemini-2.5-flash",
    instruction="""Review the research findings: {findings}

Are the findings comprehensive enough for: {topic}?
If yes, call exit_loop. If not, explain what's missing.
""",
    tools=[exit_tool],
)

loop = LoopAgent(
    name="research_loop",
    sub_agents=[researcher, reviewer],
    max_iterations=5,
)
```

### ParallelAgent — Independent output_keys

```python
from google.adk.agents import ParallelAgent, LlmAgent

# Each parallel agent MUST have a unique output_key
agent_a = LlmAgent(name="a", instruction="...", output_key="result_a")
agent_b = LlmAgent(name="b", instruction="...", output_key="result_b")
agent_c = LlmAgent(name="c", instruction="...", output_key="result_c")

parallel = ParallelAgent(
    name="parallel",
    sub_agents=[agent_a, agent_b, agent_c],
)

# Downstream agent reads all parallel results
aggregator = LlmAgent(
    name="aggregator",
    model="gemini-2.5-flash",
    instruction="""Combine these results:
A: {result_a}
B: {result_b}
C: {result_c}
""",
)
```

## Key Points

1. **Placeholders use single braces**: `{key}` not `{{key}}`. If you need
   literal braces in a prompt, use `{{` and `}}` to escape them.

2. **Missing keys are NOT errors** — they remain as literal text. This can
   cause confusing behavior if you misspell a key. Double-check key names.

3. **output_key stores the agent's final text response** — not structured data.
   If you need structured data, have the agent output JSON and parse it
   downstream.

4. **State is shared across all agents in a session** — be careful with key
   names. Use descriptive names to avoid collisions (e.g., `market_analysis`
   not `result`).

5. **For complex dynamic prompts, use InstructionProvider** — state placeholders
   are great for simple injection but cannot handle conditionals, loops, or
   file loading. Switch to InstructionProvider when you need logic.

6. **Prefer `app:` for truly global values** — company name, support email,
   and other constants should use the `app:` prefix so they persist across
   sessions and users.
