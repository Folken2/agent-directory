"""Tools module for ADK Agent Builder"""

import os

from .project_tools import (
    list_files_tool,
    package_agent_tool,
    read_file_tool,
    scaffold_agent_tool,
    validate_agent_tool,
    write_file_tool,
)


def get_tools() -> list:
    """Project tools, plus nuvel's Composio catalog lookup when the server has a key."""
    tools = [
        scaffold_agent_tool,
        write_file_tool,
        read_file_tool,
        list_files_tool,
        validate_agent_tool,
        package_agent_tool,
    ]
    if os.getenv("COMPOSIO_API_KEY"):
        from nuvel.tools.composio_tools import list_composio_toolkits_tool

        tools.append(list_composio_toolkits_tool)
    return tools
