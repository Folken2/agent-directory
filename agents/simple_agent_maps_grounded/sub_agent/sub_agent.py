from google.adk.agents import LlmAgent
# Import intelligence tools


from ..config.llm import FAST_MODEL


sub_agent = LlmAgent(
    name="sub_agent",
    # Using Gemini 2.5 Flash for best performance with complex talent analysis
    model=FAST_MODEL,
    description="AI-powered Agent for comprehensive document analysis",
    tools=[],
    instruction="""You are a specialist agent that can help with the following tasks:
    
    - Analyze a document and provide a summary of the main points
    """,
)