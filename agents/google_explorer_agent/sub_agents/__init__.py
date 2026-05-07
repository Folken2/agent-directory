"""Specialist sub-agents wrapped as AgentTools by the coordinator."""

from .web_search_specialist import web_search_specialist
from .maps_specialist import maps_specialist

__all__ = ["web_search_specialist", "maps_specialist"]
