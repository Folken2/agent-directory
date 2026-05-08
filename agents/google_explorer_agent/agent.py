"""
Local Guide — unified multi-step research agent.

Coordinator LlmAgent that delegates to two specialist sub-agents wrapped as
AgentTools: one for web search (google_search) and one for Google Maps
(google_maps_grounding). The coordinator owns planning and final-answer
synthesis; specialists own the grounded calls.
"""

from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool

from .config.llm import MODEL
from .prompt.prompt import coordinator_prompt_v1
from .sub_agents import web_search_specialist, maps_specialist
from .callbacks import after_model_callback_fix_parts

LANGUAGE_INSTRUCTION = (
    "Respond in whatever language the user writes in. Mirror their language "
    "exactly, including any mid-conversation switches.\n\n"
)


root_agent = LlmAgent(
    name="google_explorer",
    model=MODEL,
    description=(
        "Multi-step travel and local research assistant. Plans trip-style "
        "queries, delegates to web-search and Google Maps specialists, and "
        "synthesizes findings into one answer with inline map links and "
        "cited sources."
    ),
    tools=[
        AgentTool(agent=web_search_specialist),
        AgentTool(agent=maps_specialist),
    ],
    instruction=LANGUAGE_INSTRUCTION + coordinator_prompt_v1,
    after_model_callback=after_model_callback_fix_parts,
)
