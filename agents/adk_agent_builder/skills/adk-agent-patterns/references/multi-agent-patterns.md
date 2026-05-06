# Multi-Agent Hierarchy Patterns — Complete Code Examples

## Pattern 1: Coordinator with Specialist Sub-Agents

The coordinator LlmAgent uses ADK's built-in agent routing. When you add
sub_agents to an LlmAgent, ADK automatically creates transfer tools that let
the coordinator delegate to specialists.

```python
from google.adk.agents import LlmAgent

# --- Specialist agents ---

sql_expert = LlmAgent(
    name="sql_expert",
    model="gemini-2.5-flash",
    instruction="""You are a SQL expert.

Your capabilities:
- Write optimized SQL queries for any database
- Debug and fix broken queries
- Explain query execution plans
- Suggest schema improvements

When you receive a task, write the SQL and execute it using the execute_sql tool.
Always explain your query logic.
""",
    tools=[execute_sql_tool],
    output_key="sql_result",
)

visualization_expert = LlmAgent(
    name="visualization_expert",
    model="gemini-2.5-flash",
    instruction="""You are a data visualization expert.

Your capabilities:
- Create charts and graphs from data
- Choose the right visualization type for the data
- Apply professional styling and formatting

When you receive data, determine the best chart type and create it.
""",
    tools=[chart_tool, style_tool],
    output_key="chart_result",
)

report_writer = LlmAgent(
    name="report_writer",
    model="gemini-2.5-flash",
    instruction="""You are a report writer.

Your capabilities:
- Write clear, structured reports from analysis results
- Create executive summaries
- Format findings with tables and bullet points

Combine all available findings into a polished report.
""",
    output_key="report",
)


# --- Coordinator ---

coordinator = LlmAgent(
    name="coordinator",
    model="gemini-2.5-pro",
    instruction="""You are a data analysis coordinator.

You manage a team of specialists:
- sql_expert: for database queries and data extraction
- visualization_expert: for charts and graphs
- report_writer: for written reports and summaries

When the user makes a request:
1. Break it down into sub-tasks
2. Delegate each sub-task to the appropriate specialist
3. Coordinate the results into a final response

Always start with data extraction (sql_expert), then visualization if charts
are needed, then report writing for the final output.
""",
    sub_agents=[sql_expert, visualization_expert, report_writer],
)
```

**How routing works:** ADK automatically generates `transfer_to_sql_expert`,
`transfer_to_visualization_expert`, and `transfer_to_report_writer` tools for
the coordinator. The coordinator's LLM decides which specialist to invoke
based on the user's request and its instruction.

## Pattern 2: AgentTool — Calling Agents as Tools

Use `AgentTool` when you want to call a sub-agent as a tool invocation rather
than a full transfer. The sub-agent runs, returns its result, and control
returns to the calling agent immediately.

```python
from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool

# Sub-agent that will be used as a tool
fact_checker = LlmAgent(
    name="fact_checker",
    model="gemini-2.5-flash",
    instruction="""Verify the factual accuracy of the provided claim.
Research the claim using your search tools.
Return a JSON object:
{
  "claim": "the original claim",
  "verdict": "true|false|unverified",
  "evidence": "supporting evidence",
  "confidence": 0.0-1.0
}
""",
    tools=[search_tool],
)

# Wrap the agent as a tool
fact_check_tool = AgentTool(agent=fact_checker)

# Main agent uses the sub-agent as a tool
writer = LlmAgent(
    name="writer",
    model="gemini-2.5-pro",
    instruction="""You are a journalist writing factual articles.

Before including any claim in your article, use the fact_checker tool to
verify it. Only include verified claims.

Write well-researched, accurate articles on: {topic}
""",
    tools=[fact_check_tool],
)
```

**AgentTool vs sub_agents:**

| Feature | sub_agents (transfer) | AgentTool |
|---------|----------------------|-----------|
| Control flow | Transfers conversation to sub-agent | Calls sub-agent, returns to caller |
| Use case | Multi-turn specialist delegation | Single-task tool-like invocation |
| Context | Sub-agent gets full conversation | Sub-agent gets tool input only |
| Return | Sub-agent responds directly to user | Result returns to calling agent |

## Pattern 3: Nested Hierarchies

Combine agent types at different levels for complex workflows.

```python
from google.adk.agents import LlmAgent, SequentialAgent, LoopAgent, ParallelAgent

# --- Level 3: Leaf agents ---

web_searcher = LlmAgent(
    name="web_searcher",
    model="gemini-2.5-flash",
    instruction="Search the web for: {search_query}",
    tools=[search_tool],
    output_key="search_results",
)

db_searcher = LlmAgent(
    name="db_searcher",
    model="gemini-2.5-flash",
    instruction="Query internal database for: {search_query}",
    tools=[sql_tool],
    output_key="db_results",
)

# --- Level 2: Composite agents ---

# Parallel search across sources
parallel_search = ParallelAgent(
    name="parallel_search",
    sub_agents=[web_searcher, db_searcher],
)

# Synthesize search results
synthesizer = LlmAgent(
    name="synthesizer",
    model="gemini-2.5-flash",
    instruction="""Synthesize findings:
Web results: {search_results}
DB results: {db_results}
Create a unified summary.""",
    output_key="findings",
)

# Search pipeline: parallel search → synthesis
search_pipeline = SequentialAgent(
    name="search_pipeline",
    sub_agents=[parallel_search, synthesizer],
)

# Review step
reviewer = LlmAgent(
    name="reviewer",
    model="gemini-2.5-flash",
    instruction="Review findings: {findings}. If complete, call exit_loop.",
    tools=[exit_tool],
)

# Research loop: search pipeline → review, repeat
research_loop = LoopAgent(
    name="research_loop",
    sub_agents=[search_pipeline, reviewer],
    max_iterations=5,
)

# --- Level 1: Top-level coordinator ---

coordinator = LlmAgent(
    name="coordinator",
    model="gemini-2.5-pro",
    instruction="""You coordinate deep research tasks.
Use research_loop for topics that need thorough investigation.
Use report_writer for creating final deliverables.""",
    sub_agents=[research_loop, report_writer],
)
```

## Pattern 4: Dynamic Specialist Selection

When you have many specialists, document them clearly in the coordinator's
prompt so the LLM can route accurately.

```python
coordinator = LlmAgent(
    name="coordinator",
    model="gemini-2.5-pro",
    instruction="""You are a customer support coordinator.

Route requests to the appropriate specialist:

- billing_agent: Payment issues, invoices, refunds, subscription changes
- technical_agent: Bug reports, integration help, API issues, error codes
- account_agent: Password resets, account settings, profile updates, permissions
- escalation_agent: Complaints, urgent issues, VIP customers, unresolved tickets

Rules:
1. Always greet the customer first
2. Identify the category of their request
3. Transfer to the appropriate specialist
4. If unclear, ask a clarifying question before transferring
5. Never transfer to escalation_agent without first trying another specialist
""",
    sub_agents=[billing_agent, technical_agent, account_agent, escalation_agent],
)
```

## Key Points

1. **Coordinator prompt is critical** — the LLM decides routing based on the
   coordinator's instruction. Be explicit about which specialist handles what.

2. **Use a stronger model for the coordinator** — the coordinator makes
   routing decisions that affect the entire workflow. Use gemini-2.5-pro for
   coordinators and gemini-2.5-flash for specialists.

3. **Each specialist should be self-contained** — it should have its own tools,
   clear instruction, and output_key. Do not rely on the coordinator to
   pass tools.

4. **AgentTool for utility sub-agents** — use AgentTool when the sub-agent is
   a utility (fact-checking, validation, translation) that should return
   results to the caller rather than taking over the conversation.

5. **Limit hierarchy depth to 2-3 levels** — deeper nesting adds latency and
   makes debugging difficult. If you need more levels, reconsider the design.

6. **Test routing with edge cases** — ambiguous requests are the most common
   failure mode. Test with requests that could go to multiple specialists.
