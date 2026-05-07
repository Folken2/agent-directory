"""Web research specialist — single-tool LlmAgent over google_search."""

from google.adk.agents import LlmAgent
from google.adk.tools import google_search

from ..config.llm import MODEL
from ..prompt.prompt import web_specialist_prompt_v1
from ..callbacks import after_model_callback_fix_parts


web_search_specialist = LlmAgent(
    name="web_search_specialist",
    model=MODEL,
    description=(
        "Web research worker. Given a focused sub-query, runs Google Search "
        "and returns a tight, sourced snippet for the coordinator to synthesize."
    ),
    tools=[google_search],
    instruction=web_specialist_prompt_v1,
    after_model_callback=after_model_callback_fix_parts,
)
