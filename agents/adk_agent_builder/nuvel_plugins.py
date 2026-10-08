"""nuvel plugins for the builder app.

The server already applies its own chain to every agent (console logger,
self-healing tools, context filter, global instruction, file uploads; see
plugins/__init__.py). These run on top of it, for the builder only:

- cost_guard     USD cost per LLM call and per session in state; blocks the
                 session once COST_GUARD_BUDGET is spent
- context_window live context usage in state
- guardrails     halts a turn stuck in a loop (same reply over and over, or a
                 tool failing identically); the user's next message resumes it
- resilience     tool-call rate limit and a circuit breaker on scaffold/validate
- cache          per-session cache of read_file / list_files / validate_agent,
                 cleared whenever a file changes

nuvel's trace and tool-events plugins are left out: they keep per-run
counters on the plugin instance, which mixes concurrent sessions on a shared
server.
"""

from __future__ import annotations

import os

# A public builder needs a spending cap. nuvel's CostGuard reads it from
# COST_GUARD_BUDGET when constructed; the deployment can override this.
os.environ.setdefault("COST_GUARD_BUDGET", "2.00")

from nuvel.guardrails import GuardrailsPlugin  # noqa: E402
from nuvel.plugins.cache_plugin import CachePlugin  # noqa: E402
from nuvel.plugins.context_window_plugin import ContextWindowPlugin  # noqa: E402
from nuvel.plugins.cost_guard_plugin import CostGuardPlugin  # noqa: E402
from nuvel.plugins.resilience_plugin import ResiliencePlugin  # noqa: E402


def builder_plugins() -> list:
    """Fresh plugin instances, in the order nuvel's own chain runs them."""
    return [
        CostGuardPlugin(),
        ContextWindowPlugin(),
        ResiliencePlugin(),
        GuardrailsPlugin(),
        CachePlugin(),
    ]
