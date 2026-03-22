"""
Image Generation Agent with Artifact Support
"""

## adk imports
from google.adk.agents import LlmAgent
from google.adk.tools import load_artifacts

## config imports
from .config.llm import FAST_MODEL

## tools imports
from .tools.image_generation import generate_image

## prompt imports
from .prompt.prompt import prompt_v3


root_agent = LlmAgent(
    name="image_generation_agent",
    model=FAST_MODEL,
    description="Generate studio-quality images from natural language. Handles e-commerce product shots, editorial covers, social media visuals, and architectural renders with precise control over lighting, composition, and style.",
    instruction=prompt_v3,
    tools=[generate_image, load_artifacts],
)
