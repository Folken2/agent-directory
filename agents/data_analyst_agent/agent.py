"""
Data Analyst Agent with Code Execution
"""

from google.adk.agents import LlmAgent
from google.adk.code_executors import BuiltInCodeExecutor

from .config.llm import MODEL
from .prompt.prompt import prompt_v2


root_agent = LlmAgent(
    name="data_analyst_agent",
    model=MODEL,
    description=(
        "Turn raw data into insights with statistical rigor. Upload a CSV, "
        "get exploratory analysis, visualizations, and ML-powered patterns — "
        "every analysis ends with a structured Findings block (top insights, "
        "data quality flags, open questions) and inferential claims carry "
        "effect sizes and sample-size context."
    ),
    code_executor=BuiltInCodeExecutor(),
    instruction=prompt_v2,
)
