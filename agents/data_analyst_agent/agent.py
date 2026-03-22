"""
Data Analyst Agent with Code Execution
"""

## adk imports
from google.adk.agents import LlmAgent
from google.adk.code_executors import BuiltInCodeExecutor

## prompt imports
from .prompt.prompt import prompt_v1


root_agent = LlmAgent(
    name="data_analyst_agent",
    model="gemini-2.5-flash",
    description="Turn raw data into insights. Upload a CSV, get statistical analysis, visualizations, and ML-powered patterns — all executed in a sandboxed Python environment.",
    code_executor=BuiltInCodeExecutor(),
    instruction=prompt_v1,
)
