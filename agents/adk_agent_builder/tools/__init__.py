"""Tools module for ADK Agent Builder"""

import os

from .. import sandbox
from .project_tools import (
    list_files_tool,
    package_agent_tool,
    read_file_tool,
    scaffold_agent_tool,
    validate_agent_tool,
    write_file_tool,
)


def get_tools() -> list:
    """Project tools, plus the sandbox tools and nuvel's Composio lookup when configured."""
    tools = [
        scaffold_agent_tool,
        write_file_tool,
        read_file_tool,
        list_files_tool,
        validate_agent_tool,
        package_agent_tool,
    ]
    if sandbox.enabled():
        from .sandbox_tools import run_checks_tool, run_in_sandbox_tool

        tools.extend([run_checks_tool, run_in_sandbox_tool])
    if sandbox.preview_enabled():
        from .sandbox_tools import start_preview_tool, stop_preview_tool

        tools.extend([start_preview_tool, stop_preview_tool])
    if os.getenv("COMPOSIO_API_KEY"):
        from nuvel.tools.composio_tools import list_composio_toolkits_tool

        tools.append(list_composio_toolkits_tool)
    return tools
