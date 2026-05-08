# Local Guide

A multi-step travel and local-research agent. The coordinator never searches
the web or Maps directly — it decomposes the user's question, delegates to two
grounded specialists in parallel when possible, and fuses their findings into
one cited answer with inline map links.

When the agent grounds on Google Maps, it also captures the Maps **widget
context token** so the frontend can render a real, attribution-compliant
Google Maps embed inline with the assistant message.

## Architecture

```
LlmAgent: google_explorer  (root coordinator — no grounding tool)
  ├─ AgentTool(web_search_specialist)   → google_search grounding
  └─ AgentTool(maps_specialist)         → google_maps_grounding
                                          + capture_maps_widget_token callback
```

The coordinator owns planning and the final answer voice. Specialists own the
grounded calls and return raw structured blocks (place cards, web snippets)
the coordinator splices into a single response.

Travel-style queries typically chain: web (context) → maps (concrete places)
→ web (enrichment) → maps (more places). Every maps call captures its own
widget token, so multi-loop turns don't lose earlier maps.

## Quick Start

```bash
# 1. Install dependencies (from the repo root)
uv sync --no-install-project

# 2. Add API keys to .env (Gemini grounding requires a Google AI Studio key)
GOOGLE_API_KEY=your_key_here

# 3. (Optional) Enable inline Maps embeds in the frontend
#    Get a Maps Embed API key from Google Cloud Console, restrict it to
#    "Maps Embed API" + your domains, then add to adk-web-ui/.env.local:
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=your_embed_key_here

# 4. Run
adk web
```

## Project Structure

```text
google_explorer_agent/
├── agent.py                        # Root coordinator (LlmAgent)
├── sub_agents/
│   ├── web_search_specialist.py    # google_search grounding worker
│   └── maps_specialist.py          # google_maps_grounding worker
├── callbacks/
│   ├── recovery.py                 # Tool-failure retry + ADK 1.18 parts fix
│   └── maps_widget.py              # Captures Maps widget token + place chunks into state
├── config/
│   ├── llm.py                      # Shared model id (Gemini 3 Flash)
│   └── utils.py                    # Date helper
├── prompt/
│   └── prompt.py                   # Coordinator + specialist prompts (versioned)
├── metadata.json                   # Directory card metadata
└── README.md
```

## Maps Embed Pipeline

`maps_specialist`'s `after_model_callback` chain ends with
`capture_maps_widget_token`, which reads `llm_response.grounding_metadata` and
writes to session state on every `google_maps_grounding` response:

| State key                  | Shape                                        |
| -------------------------- | -------------------------------------------- |
| `maps:captures`            | list[{token, places, captured_at}] — appended per call |
| `maps:last_widget_token`   | str — convenience pointer to the latest      |
| `maps:last_places`         | list[{place_id, title, uri}] — latest only   |
| `maps:last_captured_at`    | ISO-8601 UTC                                 |

The frontend (`adk-web-ui`) reads `actions.state_delta` from each ADK event
in the SSE stream, yields a `mapsCapture` chunk per maps call, and renders
one `<MapsEmbed/>` iframe per capture beneath the message body.

The `context=<token>` query param on the embed URL is what makes the rendered
view legally compliant with Google's grounding-with-Maps terms — the token
authorizes the contextual view tied to that specific grounded response.

## Routing Cheat Sheet

| User intent                                                | Specialist           |
| ---------------------------------------------------------- | -------------------- |
| "best neighborhoods", "what's it like", reviews, news      | web_search_specialist|
| "find me Y near Z", ratings/hours/address, "map this"      | maps_specialist      |
| Trip planning                                               | both, often chained  |

## Sample Prompts

- "Plan a 4-day Lisbon itinerary: coolest neighborhoods, one rooftop bar per night, vegan-friendly lunch each day."
- "Find top-rated vegan lunch spots in Bairro Alto, Lisbon — top 3 with hours and ratings."
- "Compare Tokyo's Shibuya vs Shinjuku for a first-time visitor and recommend a hotel area with concrete options."
- "What's the current vibe of Mexico City's Roma Norte, and which 5 cafés should I actually visit?"
