---
name: adk-agent-patterns
description: >
  Agent architecture patterns for Google ADK — when and how to use LlmAgent,
  LoopAgent, SequentialAgent, ParallelAgent, and multi-agent hierarchies.
  Load this skill when deciding the agent's architecture.
---

# ADK Agent Architecture Patterns

**Version 1.0** | 2026-04-04

Select the right agent architecture for any task using Google ADK primitives.
This skill covers single agents, pipelines, loops, parallel execution, and
multi-agent hierarchies.

## Decision Tree

Use this to pick the right pattern:

```
Is the task a single, well-defined purpose with clear tools?
  YES → LlmAgent (single agent)
  NO  ↓

Must steps happen in a fixed order (e.g., plan → execute → summarize)?
  YES → SequentialAgent
  NO  ↓

Does the task require iteration until a quality threshold is met?
  YES → LoopAgent
  NO  ↓

Are there independent subtasks that can run concurrently?
  YES → ParallelAgent
  NO  ↓

Does the task require specialized sub-agents coordinated by a router?
  YES → Multi-agent hierarchy (coordinator + specialists)
```

## Pattern 1: Single LlmAgent

**When:** One clear purpose, well-defined tools, no multi-step pipeline needed.
Covers ~70% of real-world use cases.

**Characteristics:**
- Single system prompt with identity, workflow, tools, and guardrails
- Tools registered directly on the agent
- State managed through session state and output_key
- Simplest to build, test, and debug

```python
from google.adk.agents import LlmAgent

agent = LlmAgent(
    name="data_analyst",
    model="gemini-2.5-flash",
    instruction="You are a data analyst. Analyze datasets using the provided tools...",
    tools=[query_tool, chart_tool, export_tool],
    output_key="analysis_result",
)
```

**Use single LlmAgent when:**
- The agent has one job (analysis, support, monitoring, coding)
- All tools serve the same purpose
- No iterative refinement is needed
- The conversation is between one user and one agent

## Pattern 2: SequentialAgent

**When:** Tasks must happen in a strict order. Each step's output feeds the next.

**Characteristics:**
- Sub-agents execute one after another in list order
- Each agent reads previous agents' output via state (output_key)
- No looping or branching — purely linear
- Good for ETL, report generation, multi-phase analysis

```python
from google.adk.agents import SequentialAgent, LlmAgent

planner = LlmAgent(
    name="planner",
    model="gemini-2.5-flash",
    instruction="Create an analysis plan for: {user_request}",
    output_key="plan",
)

executor = LlmAgent(
    name="executor",
    model="gemini-2.5-flash",
    instruction="Execute the analysis plan: {plan}",
    tools=[query_tool, chart_tool],
    output_key="results",
)

summarizer = LlmAgent(
    name="summarizer",
    model="gemini-2.5-flash",
    instruction="Summarize the analysis results: {results}",
    output_key="summary",
)

pipeline = SequentialAgent(
    name="analysis_pipeline",
    sub_agents=[planner, executor, summarizer],
)
```

**Use SequentialAgent when:**
- Steps have clear dependencies (B needs A's output)
- The workflow is predictable and linear
- You want clean separation of concerns between steps

## Pattern 3: LoopAgent

**When:** Iterative refinement is needed — research loops, quality checks,
retry-until-success patterns.

**Characteristics:**
- Sub-agents execute repeatedly in order until exit condition
- Exit via `tool_context.actions.escalate = True` or `max_iterations`
- Ideal for: research, code review cycles, data quality loops
- Always set `max_iterations` as a safety limit

```python
from google.adk.agents import LoopAgent, LlmAgent

research_loop = LoopAgent(
    name="research_loop",
    sub_agents=[researcher, reviewer],
    max_iterations=10,
)
```

**Exit strategies:**
1. **Tool-based exit:** A reviewer agent calls an `exit_loop` tool that sets
   `tool_context.actions.escalate = True`
2. **Max iterations:** The loop stops after N cycles regardless
3. **State flag:** An agent sets a state value that a subsequent agent checks

For complete code examples with all exit strategies, load:
`load_skill_resource("adk-agent-patterns", "references/loop-patterns.md")`

**Use LoopAgent when:**
- Quality must be verified before completion
- Research needs multiple rounds of search and synthesis
- The number of iterations is not known in advance

## Pattern 4: ParallelAgent

**When:** Independent tasks can run concurrently for speed.

**Characteristics:**
- All sub-agents start simultaneously
- No ordering guarantees — agents must be independent
- Results collected in state via each agent's output_key
- Good for: multi-source research, parallel analysis, fan-out/fan-in

```python
from google.adk.agents import ParallelAgent, LlmAgent

market_analyst = LlmAgent(
    name="market_analyst",
    model="gemini-2.5-flash",
    instruction="Analyze market trends for {topic}",
    output_key="market_analysis",
)

tech_analyst = LlmAgent(
    name="tech_analyst",
    model="gemini-2.5-flash",
    instruction="Analyze technical landscape for {topic}",
    output_key="tech_analysis",
)

parallel_research = ParallelAgent(
    name="parallel_research",
    sub_agents=[market_analyst, tech_analyst],
)
```

For fan-out/fan-in patterns and aggregation examples, load:
`load_skill_resource("adk-agent-patterns", "references/parallel-patterns.md")`

**Use ParallelAgent when:**
- Tasks are truly independent (no shared state writes)
- Speed matters — concurrent execution reduces wall time
- Results will be aggregated by a downstream agent

## Pattern 5: Multi-Agent Hierarchy

**When:** Complex tasks require specialized agents coordinated by a router.

**Characteristics:**
- A coordinator LlmAgent with sub_agents that ADK auto-routes to
- Each specialist has its own tools, prompt, and expertise
- The coordinator decides which specialist handles each request
- Can nest: specialists can themselves be SequentialAgent or LoopAgent

```python
from google.adk.agents import LlmAgent

sql_expert = LlmAgent(
    name="sql_expert",
    model="gemini-2.5-flash",
    instruction="You are a SQL expert. Write and optimize queries.",
    tools=[execute_sql],
)

viz_expert = LlmAgent(
    name="viz_expert",
    model="gemini-2.5-flash",
    instruction="You are a visualization expert. Create charts.",
    tools=[chart_tool],
)

coordinator = LlmAgent(
    name="coordinator",
    model="gemini-2.5-pro",
    instruction="Route user requests to the appropriate specialist.",
    sub_agents=[sql_expert, viz_expert],
)
```

For the AgentTool pattern and advanced hierarchies, load:
`load_skill_resource("adk-agent-patterns", "references/multi-agent-patterns.md")`

**Use multi-agent hierarchy when:**
- The domain has clearly separable specializations
- Different sub-tasks need different tools or models
- You want to scale by adding new specialists without changing existing ones

## Combining Patterns

Real-world agents often combine patterns:

```
coordinator (LlmAgent with sub_agents)
  ├── simple_agent (LlmAgent)
  ├── pipeline (SequentialAgent)
  │     ├── planner (LlmAgent)
  │     └── executor (LlmAgent)
  └── research_loop (LoopAgent)
        ├── researcher (LlmAgent)
        └── reviewer (LlmAgent)
```

**Rules for combining:**
1. Start with the simplest pattern that works — do not over-engineer
2. Add complexity only when a simpler pattern fails to meet requirements
3. Each sub-agent should have a single, clear responsibility
4. Use `output_key` to pass state between agents in sequences and loops
5. Set `max_iterations` on every LoopAgent — never allow unbounded loops

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using SequentialAgent when a single LlmAgent suffices | Start simple; split only when prompts exceed ~2000 tokens or tools conflict |
| LoopAgent without max_iterations | Always set max_iterations (5-15 typical) |
| ParallelAgent with agents that write to the same state key | Each parallel agent needs a unique output_key |
| Over-engineering with multi-agent when one agent works | Profile first — multi-agent adds latency and cost |
| Not using output_key for state passing | Every agent whose output is consumed downstream needs output_key |
