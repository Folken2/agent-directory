"""
Data Analyst Agent with Code Execution
"""

## adk imports
from google.adk.agents import LlmAgent
from google.adk.code_executors import BuiltInCodeExecutor

## prompt imports
from .prompt.prompt import prompt_v0


root_agent = LlmAgent(
    name="data_analyst_agent",
    model="gemini-2.5-flash",
    description="Analyzes data by writing and executing Python code with pandas, matplotlib, and numpy.",
    code_executor=BuiltInCodeExecutor(),
    instruction=prompt_v0,
)
