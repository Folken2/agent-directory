"""
Official ADK plugins — thin wrappers that instantiate and configure
Google's built-in plugins for use across the Agent Directory.
"""

from google.adk.plugins.context_filter_plugin import ContextFilterPlugin
from google.adk.plugins.global_instruction_plugin import GlobalInstructionPlugin
from google.adk.plugins.save_files_as_artifacts_plugin import SaveFilesAsArtifactsPlugin


# Keep the last 10 invocations in context to avoid hitting token limits
# on long conversations while still preserving enough history.
context_filter_plugin = ContextFilterPlugin(num_invocations_to_keep=10)

# Shared instructions injected into every agent's LLM request.
global_instruction_plugin = GlobalInstructionPlugin(
    global_instruction=(
        "You are an agent running in the Agent Directory platform. "
        "Always be helpful, concise, and accurate. "
        "When using tools, prefer to verify results before presenting them. "
        "If a tool fails, explain what happened and suggest alternatives."
    ),
)

# Automatically save files embedded in user messages as session artifacts.
save_files_as_artifacts_plugin = SaveFilesAsArtifactsPlugin()
