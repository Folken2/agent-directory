"""Utility helpers for the Google Explorer agent."""

from datetime import datetime


def get_current_date() -> str:
    """Return today's date as YYYY-MM-DD."""
    return datetime.now().strftime("%Y-%m-%d")
