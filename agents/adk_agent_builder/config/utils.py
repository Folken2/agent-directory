"""
Utility functions for the agent configuration.
"""

from datetime import datetime


def get_current_date() -> str:
    """
    Get the current date in a human-readable format suitable for prompts.

    Returns:
        str: Current date formatted as "Month Day, Year" (e.g., "January 15, 2025")
    """
    return datetime.now().strftime("%B %d, %Y")
