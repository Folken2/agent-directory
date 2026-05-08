"""
Image Generation Agent with Artifact Support
"""

## adk imports
from google.adk.agents import LlmAgent
from google.adk.tools import load_artifacts

## config imports
from .config.llm import FAST_MODEL

## tools imports
from .tools.image_generation import generate_image, refine_image

## prompt imports
from .prompt.prompt import prompt_v4


root_agent = LlmAgent(
    name="image_generation_agent",
    model=FAST_MODEL,
    description="Generate studio-quality images from natural language and refine them iteratively — adjust lighting, composition, color, or remove elements while keeping the subject and framing intact.",
    instruction=prompt_v4,
    tools=[generate_image, refine_image, load_artifacts],
)
