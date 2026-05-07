"""
exit_loop — tool the Critic agent calls when research coverage is sufficient.

Setting `tool_context.actions.escalate = True` is the canonical ADK signal for
a sub-agent inside a LoopAgent to terminate the loop early. Without this, the
loop runs until `max_iterations`.
"""

from google.adk.tools.tool_context import ToolContext


def exit_loop(tool_context: ToolContext) -> dict:
    """Signal that research coverage is sufficient and the research loop should exit.

    Call this BEFORE outputting your STATUS: DONE line. The tool call is what
    actually exits the loop; the STATUS line is for downstream agents to read.
    """
    tool_context.actions.escalate = True
    return {"status": "loop_will_exit"}
