"""Maps specialist — single-tool LlmAgent over google_maps_grounding."""

from google.adk.agents import LlmAgent
from google.adk.tools import google_maps_grounding

from ..config.llm import MODEL
from ..prompt.prompt import maps_specialist_prompt_v1
from ..callbacks import (
    after_tool_recovery_callback,
    after_model_callback_fix_parts,
    capture_maps_widget_token,
)


maps_specialist = LlmAgent(
    name="maps_specialist",
    model=MODEL,
    description=(
        "Google Maps worker. Given a focused place-search sub-query, returns "
        "structured place blocks (name, address, rating, hours, map link) "
        "for the coordinator to splice into a final answer."
    ),
    tools=[google_maps_grounding],
    instruction=maps_specialist_prompt_v1,
    after_tool_callback=after_tool_recovery_callback,
    after_model_callback=[
        after_model_callback_fix_parts,
        capture_maps_widget_token,
    ],
)
