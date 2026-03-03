"""
Server-level plugins for the Agent Directory.

Plugins apply globally to ALL agents and tool calls via ADK's
extra_plugins mechanism. Execution order:

  1. ConsoleLoggerPlugin  — Pretty terminal output (observation only)
  2. SelfHealingToolPlugin — Error recovery with reflect-and-retry

To add more plugins later, create a new file in this directory,
instantiate a singleton, and add its qualified name to PLUGIN_QUALIFIED_NAMES.
"""

from .console_logger import console_logger_plugin
from .circuit_breaker import self_healing_plugin

# Fully qualified names for ADK's extra_plugins parameter.
# ADK resolves these via importlib at runtime.
PLUGIN_QUALIFIED_NAMES: list[str] = [
    "plugins.console_logger.console_logger_plugin",
    "plugins.circuit_breaker.self_healing_plugin",
]

__all__ = [
    "console_logger_plugin",
    "self_healing_plugin",
    "PLUGIN_QUALIFIED_NAMES",
]
