# LoopAgent Patterns — Complete Code Examples

## Pattern 1: Planner-Executor-Reviewer Cycle

The most common LoopAgent pattern. A planner creates tasks, an executor runs
them, and a reviewer decides whether to continue or exit.

```python
from google.adk.agents import LoopAgent, LlmAgent
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


def exit_loop(tool_context: ToolContext) -> dict:
    """Signal the loop to stop when research is complete."""
    tool_context.actions.escalate = True
    return {"status": "success", "message": "Loop complete — all tasks finished."}


exit_tool = FunctionTool(func=exit_loop)


planner = LlmAgent(
    name="planner",
    model="gemini-2.5-flash",
    instruction="""You are a research planner.

Given the goal: {goal}

Review the current findings (if any): {findings}

Create or update a research plan as a JSON list of tasks:
[
  {"id": 1, "task": "description", "status": "pending|done"},
  ...
]

Mark completed tasks as "done" based on the findings.
Only include tasks that are still needed.
""",
    output_key="plan",
)


executor = LlmAgent(
    name="executor",
    model="gemini-2.5-flash",
    instruction="""You are a research executor.

Current plan: {plan}
Previous findings: {findings}

Execute the FIRST pending task from the plan.
Use your search tools to gather information.
Add your new findings to the existing findings.

Output ALL findings (old + new) as a structured report.
""",
    tools=[search_tool],  # Replace with your actual search tool
    output_key="findings",
)


reviewer = LlmAgent(
    name="reviewer",
    model="gemini-2.5-flash",
    instruction="""You are a research quality reviewer.

Goal: {goal}
Plan: {plan}
Findings: {findings}

Evaluate whether the research is complete:
1. Are all planned tasks addressed?
2. Is the information sufficient to answer the goal?
3. Are there gaps that need more research?

If COMPLETE: call the exit_loop tool to stop the research.
If INCOMPLETE: explain what's still needed (the planner will update the plan).
""",
    tools=[exit_tool],
)


research_loop = LoopAgent(
    name="research_loop",
    sub_agents=[planner, executor, reviewer],
    max_iterations=10,
)
```

## Pattern 2: Exit via Tool with escalate

The cleanest exit mechanism. The reviewer calls a tool that sets
`tool_context.actions.escalate = True`.

```python
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


def exit_loop(tool_context: ToolContext) -> dict:
    """Call this tool when the task is complete and no more iterations are needed."""
    tool_context.actions.escalate = True
    return {"status": "complete", "message": "Exiting loop — quality threshold met."}


def request_revision(feedback: str, tool_context: ToolContext) -> dict:
    """Call this tool when revisions are needed. Provide specific feedback."""
    # Store feedback in state for the next iteration
    tool_context.state["revision_feedback"] = feedback
    return {"status": "revision_requested", "feedback": feedback}


exit_tool = FunctionTool(func=exit_loop)
revision_tool = FunctionTool(func=request_revision)


reviewer = LlmAgent(
    name="reviewer",
    model="gemini-2.5-flash",
    instruction="""Review the draft: {draft}

If the draft meets quality standards, call exit_loop.
If revisions are needed, call request_revision with specific feedback.

Quality criteria:
- Accurate and well-sourced
- Clear and well-structured
- Addresses the original question fully
""",
    tools=[exit_tool, revision_tool],
)
```

## Pattern 3: Exit via State Flag

An alternative where one agent sets a state value and a conditional check
stops the loop. Useful when exit logic is in a tool rather than an LLM.

```python
from google.adk.agents import LoopAgent, LlmAgent
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


def check_quality(content: str, tool_context: ToolContext) -> dict:
    """Programmatic quality check — no LLM needed for this step."""
    score = compute_quality_score(content)  # Your scoring function
    tool_context.state["quality_score"] = score

    if score >= 0.85:
        tool_context.actions.escalate = True
        return {"status": "passed", "score": score}
    else:
        return {"status": "needs_improvement", "score": score}


quality_tool = FunctionTool(func=check_quality)


writer = LlmAgent(
    name="writer",
    model="gemini-2.5-flash",
    instruction="""Write or improve the content for: {topic}

Previous draft: {draft}
Quality score: {quality_score}

If there's a previous draft, improve it based on the quality feedback.
Output the complete revised content.
""",
    output_key="draft",
)

checker = LlmAgent(
    name="checker",
    model="gemini-2.5-flash",
    instruction="""Check the quality of: {draft}

Call the check_quality tool with the draft content.
""",
    tools=[quality_tool],
)

writing_loop = LoopAgent(
    name="writing_loop",
    sub_agents=[writer, checker],
    max_iterations=5,
)
```

## Pattern 4: Simple Retry Loop

For cases where you just need to retry an operation until it succeeds.

```python
from google.adk.agents import LoopAgent, LlmAgent
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


def validate_output(output: str, tool_context: ToolContext) -> dict:
    """Validate that the output is valid JSON with required fields."""
    import json
    try:
        data = json.loads(output)
        required = ["title", "summary", "recommendations"]
        missing = [f for f in required if f not in data]
        if missing:
            return {"valid": False, "error": f"Missing fields: {missing}"}
        tool_context.actions.escalate = True
        return {"valid": True}
    except json.JSONDecodeError as e:
        return {"valid": False, "error": f"Invalid JSON: {e}"}


validate_tool = FunctionTool(func=validate_output)

generator = LlmAgent(
    name="generator",
    model="gemini-2.5-flash",
    instruction="""Generate a report as valid JSON with these fields:
- title: string
- summary: string
- recommendations: list of strings

Topic: {topic}
Previous validation error (if any): {validation_error}
""",
    output_key="report_json",
)

validator = LlmAgent(
    name="validator",
    model="gemini-2.5-flash",
    instruction="Validate this output: {report_json}. Call validate_output with the text.",
    tools=[validate_tool],
)

retry_loop = LoopAgent(
    name="retry_loop",
    sub_agents=[generator, validator],
    max_iterations=3,
)
```

## Key Points

1. **Always set `max_iterations`** — typical values are 3-15 depending on task
   complexity. Never allow unbounded loops.

2. **Prefer `escalate = True` for exit** — it is the cleanest and most reliable
   mechanism. The tool function sets it, and ADK stops the loop immediately
   after the current agent finishes.

3. **Use `output_key` for state passing** — each agent in the loop should write
   its output to a unique state key so subsequent agents (and the next
   iteration) can read it.

4. **The loop re-executes ALL sub_agents each iteration** — if you have
   `[planner, executor, reviewer]`, all three run every cycle. Design prompts
   so agents handle being re-invoked (e.g., "update the plan" not "create a
   plan").

5. **Cost awareness** — each iteration costs LLM calls for every sub-agent.
   A loop with 3 agents and 10 iterations = 30 LLM calls. Use the cheapest
   model that works (gemini-2.5-flash) for inner loop agents.
