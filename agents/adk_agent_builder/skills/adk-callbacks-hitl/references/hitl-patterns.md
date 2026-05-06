# HITL (Human-in-the-Loop) Patterns

## Pattern 1: Plan Approval Gate (BaseAgent)

A `BaseAgent` subclass that blocks execution until a human approves the plan. The agent generates a plan, stores it in state, and waits for approval before proceeding.

```python
import logging
from typing import AsyncGenerator

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.genai.types import Content, Part

logger = logging.getLogger(__name__)


class PlanApprovalGate(BaseAgent):
    """Blocks execution until the plan in state is approved by a human.

    Flow:
    1. Upstream agent stores a plan in state["plan"]
    2. This agent checks state["plan_approved"]
    3. If not approved: yields a message asking for approval, then stops
    4. If approved: yields a confirmation and passes through

    The human approves by setting state["plan_approved"] = True
    (e.g., via the ADK web UI or an API call).
    """

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        plan = ctx.session.state.get("plan", "")
        approved = ctx.session.state.get("plan_approved", False)

        if not plan:
            logger.warning("[HITL CHECK] No plan found in state")
            yield Event(
                author=self.name,
                content=Content(
                    parts=[Part(text="No plan has been generated yet. "
                                     "Please generate a plan first.")]
                ),
            )
            return

        if not approved:
            logger.info("[HITL CHECK] Plan pending approval")
            yield Event(
                author=self.name,
                content=Content(
                    parts=[Part(text=f"The following plan requires your approval:\n\n"
                                     f"{plan}\n\n"
                                     f"Please review and approve to continue.")]
                ),
                actions=EventActions(
                    state_delta={"plan_status": "awaiting_approval"},
                ),
            )
            return

        logger.info("[HITL ALLOW] Plan approved, proceeding")
        yield Event(
            author=self.name,
            content=Content(
                parts=[Part(text="Plan approved. Proceeding with execution.")]
            ),
            actions=EventActions(
                state_delta={"plan_status": "executing"},
            ),
        )
```

### Wiring the PlanApprovalGate

```python
from google.adk.agents import LlmAgent, SequentialAgent

planner = LlmAgent(
    name="planner",
    model="gemini-2.0-flash",
    instruction="Generate a step-by-step plan and store it in state.",
    output_key="plan",
)

gate = PlanApprovalGate(name="approval_gate")

executor = LlmAgent(
    name="executor",
    model="gemini-2.0-flash",
    instruction="Execute the approved plan step by step.",
)

pipeline = SequentialAgent(
    name="pipeline",
    sub_agents=[planner, gate, executor],
)
```

## Pattern 2: Defensive before_tool_callback

A `before_tool_callback` that blocks sensitive tools unless they meet specific allow conditions. Uses structured logging for auditability.

```python
import logging
from typing import Any

from google.adk.agents.callback_context import CallbackContext
from google.adk.tools import BaseTool

logger = logging.getLogger(__name__)

# Tools that require approval
SENSITIVE_TOOLS = {
    "delete_record",
    "send_email",
    "modify_permissions",
    "execute_sql",
    "deploy_service",
}

# Tools that are always safe
ALWAYS_ALLOWED = {
    "list_skills",
    "load_skill",
    "load_skill_resource",
    "get_time",
    "search",
}


def defensive_tool_gate(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext,
) -> dict | None:
    """HITL gate: block sensitive tools unless pre-approved.

    Allow conditions (any one is sufficient):
    1. Tool is in the ALWAYS_ALLOWED set
    2. Tool is explicitly approved in state["approved_tools"]
    3. State["hitl_bypass"] is True (for automated testing)
    """
    tool_name = tool.name

    # Condition 1: Always-allowed tools
    if tool_name in ALWAYS_ALLOWED:
        logger.debug("[HITL ALLOW] Tool '%s' is always allowed", tool_name)
        return None

    # Condition 2: Not a sensitive tool
    if tool_name not in SENSITIVE_TOOLS:
        logger.debug("[HITL ALLOW] Tool '%s' is not sensitive", tool_name)
        return None

    # Condition 3: Bypass for testing
    if tool_context.state.get("hitl_bypass", False):
        logger.warning("[HITL ALLOW] Bypass enabled for tool '%s'", tool_name)
        return None

    # Condition 4: Explicitly approved
    approved = tool_context.state.get("approved_tools", [])
    if tool_name in approved:
        logger.info("[HITL ALLOW] Tool '%s' is pre-approved", tool_name)
        return None

    # Block the tool
    logger.warning(
        "[HITL BLOCK] Tool '%s' blocked — requires approval. Args: %s",
        tool_name,
        args,
    )
    return {
        "status": "blocked",
        "error": (
            f"Tool '{tool_name}' requires human approval before execution. "
            f"Planned action: {tool_name}({args}). "
            f"To approve, add '{tool_name}' to the approved_tools list in session state."
        ),
    }
```

### Registering the Gate

```python
agent = LlmAgent(
    name="guarded_agent",
    model="gemini-2.0-flash",
    instruction="You are a helpful assistant. Some tools require approval.",
    tools=[...],
    before_tool_callback=defensive_tool_gate,
)
```

## Pattern 3: Multi-Step Approval with Logging

For workflows where multiple steps each need approval:

```python
import logging
from typing import Any

from google.adk.agents.callback_context import CallbackContext
from google.adk.tools import BaseTool

logger = logging.getLogger(__name__)


def step_approval_gate(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext,
) -> dict | None:
    """Track and gate each step in a multi-step workflow."""
    current_step = tool_context.state.get("current_step", 0)
    approved_steps = tool_context.state.get("approved_steps", 0)

    if tool.name == "execute_step":
        step_num = args.get("step_number", current_step + 1)

        if step_num > approved_steps:
            logger.info(
                "[HITL CHECK] Step %d requires approval (approved up to %d)",
                step_num,
                approved_steps,
            )
            return {
                "status": "pending_approval",
                "message": f"Step {step_num} requires approval before execution.",
                "step_details": args,
            }

        logger.info("[HITL ALLOW] Step %d is approved", step_num)
        tool_context.state["current_step"] = step_num
        return None

    return None
```

## Logging Conventions

Use consistent prefixes for HITL-related log messages:

| Prefix | Meaning |
|--------|---------|
| `[HITL CHECK]` | Evaluating whether to allow or block |
| `[HITL ALLOW]` | Decision: allowing the action |
| `[HITL BLOCK]` | Decision: blocking the action |
| `[HITL APPROVE]` | Human has approved an action |
| `[HITL REJECT]` | Human has rejected an action |

This makes it easy to filter logs for HITL decisions:
```bash
grep "\[HITL" agent.log
```
