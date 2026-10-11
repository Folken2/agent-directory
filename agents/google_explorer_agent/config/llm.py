"""Model shared by the coordinator and both specialists.

Native Gemini (make_gemini), not LiteLlm: google_search and
google_maps_grounding are Gemini API features.
"""

from model_factory import make_gemini

MODEL = make_gemini("google_explorer_agent", "gemini-3.8-flash")
