---
title: Build a multi-agent deep research pipeline with Google ADK
seoTitle: ADK Deep Research Pipeline: LoopAgent and exit_loop
description: Build a deep research agent in Google ADK: plan, search and critique in a LoopAgent, stop early with exit_loop, and share results through session state.
published: 2026-11-05
agents: deep_research_agent
keywords: ADK deep research, Google ADK, Agent Development Kit, LoopAgent, SequentialAgent, exit_loop, output_key, multi-agent pipeline, escalate
---

A single agent with a search tool stops when it feels finished. A research pipeline gives that decision to a separate agent with a written standard: one agent plans, one searches, one checks the coverage and sends the searcher back if it falls short, and one writes the report.

The code below is the [Deep Research Agent](/agents/deep_research_agent) on this site. Everything was checked against **google-adk 2.10.0**, using the agent's real objects with a scripted model and a live run on this site.

## The short version

Four `LlmAgent`s and two shell agents, none of which call a model themselves. `SequentialAgent` runs its children in order, and `LoopAgent` repeats them:

```python
research_loop = LoopAgent(
    name="research_loop",
    description="Iterates Researcher → Critic until coverage is sufficient or max_iterations is reached.",
    sub_agents=[researcher, critic],
    max_iterations=3,
)

root_agent = SequentialAgent(
    name="deep_research_agent",
    description=(
        "Autonomous deep-research pipeline. Decomposes a question into a plan, "
        "iteratively gathers evidence with Tavily, critiques coverage, and "
        "composes a cited markdown report — all in one turn."
    ),
    sub_agents=[planner, research_loop, writer],
)
```

The flow is planner, then researcher and critic up to three times, then writer. All of it happens in one user turn, with no user input between steps.

## Pass results through session state

The sub-agents never call each other. Each one saves its final text to session state with `output_key`, and later agents read it through placeholders in their instructions:

| Key | Written by | Read by |
| --- | --- | --- |
| `research_plan` | planner | researcher, critic, writer |
| `findings` | researcher | researcher (next pass), critic, writer |
| `critique` | critic | researcher (next pass) |
| `final_report` | writer | nothing: it's the answer |

Here is the researcher, with its Tavily server attached through `McpToolset`, which the [MCP guide](/guides/adk-mcp-toolset) covers in detail:

```python
researcher = LlmAgent(
    model=FAST_MODEL,
    name="researcher",
    description="Executes the research plan using Tavily web search and content extraction, building cited findings.",
    instruction=researcher_prompt,
    tools=[
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://mcp.tavily.com/mcp/",
                headers={"Authorization": f"Bearer {TAVILY_API_KEY}"},
            ),
        )
    ],
    before_agent_callback=before_agent_callback_update_tools,
    output_key="findings",
)
```

`FAST_MODEL` is a `LiteLlm` model routed through OpenRouter, built in the repo's `agents/model_factory.py`. A plain Gemini model name also works, and then `pip install "google-adk[mcp]"` is all you need. `LiteLlm` also needs the `litellm` package, which `google-adk[extensions]` includes.

Two things in the researcher's prompt make the loop work. It is an f-string, so the doubled braces come out as single ones:

```text
- **Research plan** (always present):
  {{research_plan}}

- **Previous findings** (present from iteration 2 onwards — empty on first run):
  {{findings?}}

- **Critic feedback** (present from iteration 2 onwards — gaps to fill):
  {{critique?}}
```

The `?` makes a key optional. On the first pass `findings` and `critique` don't exist yet, and without the `?` the agent would raise an error instead of starting.

The second is less obvious: `output_key` overwrites. Each pass replaces `findings`, it doesn't add to it, so the prompt tells the researcher to "keep them and add new findings" and "never regress". If you leave that out, every pass throws away the one before it.

## Stop the loop with exit_loop

Without an exit signal, the loop always runs to `max_iterations`. The critic stops it early by calling this tool:

```python
def exit_loop(tool_context: ToolContext) -> dict:
    """Signal that research coverage is sufficient and the research loop should exit.

    Call this BEFORE outputting your STATUS: DONE line. The tool call is what
    actually exits the loop; the STATUS line is for downstream agents to read.
    """
    tool_context.actions.escalate = True
    return {"status": "loop_will_exit"}
```

ADK adds `tool_context` itself, so the model sees a tool with no arguments. `LoopAgent` watches each event for `actions.escalate` and behaves like this:

- **The current sub-agent finishes its turn first.** The critic still gets its reply to the tool call and writes `STATUS: DONE`, which is saved to `critique`.
- **Only the loop stops.** `SequentialAgent` doesn't check `escalate`, so the writer still runs.
- **Reaching `max_iterations` isn't an error.** The loop just ends and the writer uses whatever findings exist.

ADK has its own version, `from google.adk.tools import exit_loop`, which also sets `skip_summarization`. That ends the critic's turn at the tool call, so it writes no closing text and `critique` is never saved. Use the built-in tool if nothing reads that text; this agent writes its own so the critic can state why it stopped.

## Give the critic a bar it can count

A critic asked whether the research is "good enough" tends to agree after one pass. This one gets rules it can check, and the prompt tells it to apply them mechanically:

```text
A subquery clears the bar only when ALL of the following are true:
- **≥5 sourced facts** are recorded under that subquery
- The facts come from **≥2 distinct domains** (not all from one site)
- At least one fact addresses a **quantitative or specific detail** (a number,
  a date, a version, a named entity) — not just qualitative summary
```

Its output is either `STATUS: DONE` or `STATUS: CONTINUE` with a numbered list of gaps. The gaps must be specific, because the researcher reads them through `{critique?}` on the next pass.

In a live run on a Postgres replication question, the critic returned `STATUS: CONTINUE`, the researcher went back, and the critic then called `exit_loop` and returned `STATUS: DONE`.

All four agents emit text, so decide what the user sees. This site sets `"finalSubAgent": "writer"` in the agent's `metadata.json` and shows the other agents' output as collapsed steps. That field belongs to this site, not ADK.

## LoopAgent and SequentialAgent are deprecated

In ADK 2.10, creating either one emits a `DeprecationWarning`: "LoopAgent is deprecated in favor of Workflow and will be removed in a future version. Workflow cannot yet be used as an LlmAgent sub-agent."

They still work, and this agent runs on them. It pins `google-adk==2.10.0` so an upgrade can't remove them unannounced, and you should pin too. New projects should look at `Workflow` in `google.adk.workflow`, a graph-based replacement this guide doesn't cover.

## Common errors

**`KeyError` with "Context variable not found".** A placeholder names a state key that doesn't exist yet. Add `?` if it can be missing, or check the agent that should write it: `output_key` only saves a final response that contains text, so an agent that ends without any text saves nothing.

**`Agent ... already has a parent agent`.** The same agent object was added to two parents. Create a separate instance for each one.

**`Failed to create MCP session: … Client error '401 Unauthorized'`.** The search server rejected the key. This agent builds its header without checking the variable, so an unset `TAVILY_API_KEY` sends `Bearer None`. The [MCP guide](/guides/adk-mcp-toolset#common-errors) covers the other connection errors.

**The loop always runs to the limit.** The critic isn't calling the tool. Check it's in the critic's `tools`, and tell the prompt plainly that the call is what ends the loop, not the status line. A critic that only writes `STATUS: DONE` changes nothing.

**The loop never ends.** `max_iterations` defaults to `None`, which means run until something escalates. Always set it. Three passes is this agent's limit; each one adds searches and tokens.

**Later passes lose earlier findings.** `output_key` overwrote them. See the merge instruction above.

## Try it

Ask the [Deep Research Agent](/agents/deep_research_agent) a question with several angles, such as a comparison with a recent date in it, and open the steps to watch the plan and the critic's decisions. Its page links to the full source on GitHub. For agents that run code instead of searching, see [ADK code execution: build a data analyst agent](/guides/adk-code-execution-data-analyst).
