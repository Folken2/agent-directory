import pathlib
import sys

# ADK imports each agent with agents/ on sys.path, which is how agents reach the
# shared agents/model_factory.py. Tests import agents as `agents.<name>`, so put
# agents/ on the path the same way.
AGENTS_DIR = str(pathlib.Path(__file__).resolve().parent.parent / "agents")
if AGENTS_DIR not in sys.path:
    sys.path.insert(0, AGENTS_DIR)
