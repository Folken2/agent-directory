"""
Simple Agent with Web Search Capabilities
"""

## adk imports
from google.adk.agents import LlmAgent
from google.adk.tools import google_search

## prompt imports
from .prompt.prompt import prompt_v1



root_agent = LlmAgent(
    name="web_search_agent",
    model="gemini-2.5-flash",
    description="Get accurate, sourced answers grounded in live web search. Every response is backed by real-time Google Search results with the top 4 most relevant sources cited.",
    tools=[google_search],
    instruction=prompt_v1,
)

