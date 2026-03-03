"""
Custom entrypoint to start ADK with a Neon/Postgres session service using .env.

Usage:
  1) Ensure .env contains SESSION_SERVICE_URI (and optionally AGENTS_DIR).
  2) (Optional) Install python-dotenv if you want automatic .env loading.
  3) Run: python run_adk.py
"""

import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import uvicorn
from google.adk.cli.fast_api import get_fast_api_app
from plugins import PLUGIN_QUALIFIED_NAMES

# Optional: load .env automatically if python-dotenv is installed.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ModuleNotFoundError:
    # Safe to ignore; just ensure SESSION_SERVICE_URI is in environment.
    pass


def main() -> None:
    agents_dir = os.getenv("AGENTS_DIR", ".")
    session_uri = os.getenv("SESSION_SERVICE_URI")
    port = int(os.getenv("PORT", "8000"))  # Railway sets PORT env var

    if not session_uri:
        raise RuntimeError("SESSION_SERVICE_URI is required (set it in .env or env vars).")

    session_uri = _normalize_to_asyncpg_uri(session_uri)
    connect_args = {"ssl": "require"}

    app = get_fast_api_app(
        agents_dir=agents_dir,
        session_service_uri=session_uri,
        session_db_kwargs={"connect_args": connect_args},
        web=False,         # API only, no web UI assets
        a2a=False,         # set True if you use A2A
        host="0.0.0.0",
        port=port,
        url_prefix=None,
        reload_agents=False,  # set True in dev for hot reload of agents
        extra_plugins=PLUGIN_QUALIFIED_NAMES,
    )

    uvicorn.run(app, host="0.0.0.0", port=port)


def _normalize_to_asyncpg_uri(uri: str) -> str:
    """Convert to asyncpg scheme and strip unsupported query args (sslmode/channel_binding)."""
    if uri.startswith("postgresql://"):
        uri = uri.replace("postgresql://", "postgresql+asyncpg://", 1)

    parsed = urlsplit(uri)
    qs = parse_qsl(parsed.query, keep_blank_values=True)
    filtered = [(k, v) for (k, v) in qs if k.lower() not in {"sslmode", "channel_binding", "channelbinding"}]
    new_query = urlencode(filtered)
    return urlunsplit(parsed._replace(query=new_query))


if __name__ == "__main__":
    main()

