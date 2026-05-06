# InstructionProvider Pattern — Complete Code Examples

## Overview

An InstructionProvider is an async function that receives a `ReadonlyContext`
and returns the full prompt string. ADK calls this function before every LLM
invocation, allowing the prompt to change dynamically based on session state,
loaded context files, user permissions, or any other runtime data.

## Basic Pattern

```python
from google.adk.agents import LlmAgent


async def get_agent_instruction(ctx) -> str:
    """ADK InstructionProvider receiving ReadonlyContext.

    ctx.state gives access to session state (read-only).
    Return the full prompt string.
    """
    user_name = ctx.state.get("user_name", "User")
    user_role = ctx.state.get("user_role", "viewer")

    return f"""You are a data analyst.

Current user: {user_name} (role: {user_role})

Help the user analyze data using SQL queries and visualizations.
"""


agent = LlmAgent(
    name="analyst",
    model="gemini-2.5-flash",
    instruction=get_agent_instruction,
)
```

## Production Pattern: Context File Loading

Load reference material from files so prompts stay maintainable and
domain experts can edit context without touching Python.

```python
from pathlib import Path
from google.adk.agents import LlmAgent


CONTEXTS_DIR = Path(__file__).parent / "contexts"

# Cache context files at module load time (they don't change at runtime)
_context_cache: dict[str, str] = {}


def _load_context(filename: str) -> str:
    """Load a context file with caching."""
    if filename not in _context_cache:
        filepath = CONTEXTS_DIR / filename
        if filepath.exists():
            _context_cache[filename] = filepath.read_text()
        else:
            _context_cache[filename] = ""
    return _context_cache[filename]


async def get_agent_instruction(ctx) -> str:
    """Build the full prompt from context files and session state."""

    # --- Load static context files ---
    domain_knowledge = _load_context("domain_knowledge.md")
    style_guide = _load_context("style_guide.md")
    schema_reference = _load_context("schema_reference.md")

    # --- Read dynamic state ---
    user_name = ctx.state.get("user_name", "User")
    user_role = ctx.state.get("user_role", "viewer")
    company_name = ctx.state.get("app:company_name", "the company")
    mode = ctx.state.get("mode", "default")

    # --- Build tools section dynamically based on role ---
    tools_section = _build_tools_section(user_role)

    # --- Build guardrails based on mode ---
    if mode == "incident":
        guardrails = """## Guardrails — Incident Mode
- Prioritize speed over thoroughness
- Skip pleasantries — lead with facts
- Auto-escalate if metrics worsen during analysis
"""
    else:
        guardrails = """## Guardrails
- Always confirm before executing queries that touch large tables
- Present data in markdown tables when under 20 rows
- Ask for clarification if the request is ambiguous
"""

    # --- Assemble the full prompt ---
    return f"""You are DataBot, a senior data analyst for {company_name}.

Current user: {user_name} (role: {user_role})
Mode: {mode}

## Domain Knowledge
{domain_knowledge}

## Style Guide
{style_guide}

## Database Schema
{schema_reference}

## Workflow

1. Clarify the user's question if ambiguous
2. Plan the analysis approach
3. Execute SQL queries
4. Analyze and interpret results
5. Visualize if beneficial
6. Summarize key findings

{tools_section}

## Rules
- Respond in the same language the user uses
- Show SQL before executing
- Round numbers to 2 decimal places

{guardrails}
"""


def _build_tools_section(role: str) -> str:
    """Build tools documentation based on user role."""
    base_tools = """## Tools

### execute_sql
- When: Any data query or analysis
- Input: valid SQL query
- Notes: Read-only, 30s timeout
"""

    if role in ("admin", "analyst"):
        base_tools += """
### export_csv
- When: User requests data export
- Input: data (JSON), filename

### create_chart
- When: Data benefits from visualization
- Input: chart_type, data, title
"""

    if role == "admin":
        base_tools += """
### manage_permissions
- When: Admin requests to change user access
- Input: user_id, new_role
"""

    return base_tools


agent = LlmAgent(
    name="data_analyst",
    model="gemini-2.5-flash",
    instruction=get_agent_instruction,
)
```

## Directory Structure

```
agent_package/
  __init__.py
  agent.py              # Contains InstructionProvider + agent definition
  contexts/
    domain_knowledge.md  # Business rules, domain terms, data dictionary
    style_guide.md       # Output formatting preferences
    schema_reference.md  # Database tables and columns
```

## Pattern: Mode-Switching Prompt

Change agent behavior based on a state flag.

```python
async def get_instruction(ctx) -> str:
    mode = ctx.state.get("mode", "conversational")

    base_identity = "You are AnalysisBot, a data analysis assistant."

    mode_instructions = {
        "conversational": """
## Mode: Conversational
- Be friendly and explanatory
- Explain your reasoning step by step
- Suggest follow-up questions
- Use analogies to explain complex findings
""",
        "report": """
## Mode: Report Generation
- Be concise and formal
- Use structured headings and tables
- Include executive summary at the top
- No conversational filler
""",
        "incident": """
## Mode: Incident Response
- Be terse and factual
- Lead with the most critical finding
- Include exact numbers and timestamps
- Skip explanations unless asked
""",
    }

    return f"""{base_identity}

{mode_instructions.get(mode, mode_instructions["conversational"])}

## Tools
...
"""
```

## Pattern: Permission-Based Prompt

Restrict capabilities based on user permissions.

```python
async def get_instruction(ctx) -> str:
    permissions = ctx.state.get("user_permissions", [])

    capabilities = ["- Query data using SQL (read-only)"]

    if "export" in permissions:
        capabilities.append("- Export query results to CSV")
    if "visualize" in permissions:
        capabilities.append("- Create charts and visualizations")
    if "admin" in permissions:
        capabilities.append("- View system metrics and logs")
        capabilities.append("- Manage user permissions")

    restrictions = []
    if "admin" not in permissions:
        restrictions.append("- NEVER show system metrics or internal logs")
    if "export" not in permissions:
        restrictions.append("- NEVER export data — suggest the user request export access")

    caps_text = "\n".join(capabilities)
    restrict_text = "\n".join(restrictions) if restrictions else "- None"

    return f"""You are DataBot, a data analyst.

## Capabilities
{caps_text}

## Restrictions
{restrict_text}

## Workflow
...
"""
```

## Key Points

1. **The function must be async** — ADK expects `async def` for InstructionProviders.
   The parameter is a `ReadonlyContext` (not `InvocationContext`).

2. **Cache static content** — context files loaded from disk should be cached
   at module level. They don't change between invocations.

3. **Use `ctx.state.get()` with defaults** — state keys may not exist in every
   session. Always provide a sensible default.

4. **Keep the total prompt under ~4000 tokens** — if context files push you
   over this, summarize or split into multiple agents.

5. **Test the prompt function directly** — you can call `get_instruction(mock_ctx)`
   in unit tests to verify prompt assembly without running ADK.

6. **State is read-only in InstructionProvider** — you cannot write to state
   from inside the instruction function. Use tools or callbacks for state writes.
