# Nuvel Agent Builder

A meta-agent that creates production-ready Google ADK agents from natural language descriptions. Powered by **Nuvel** — an open-source agent toolkit that scaffolds, iterates, and publishes agents.

## Overview

The Nuvel Agent Builder helps you design and build ADK agents. Unlike the old ADK Agent Builder (which only advised), this agent is backed by the **Nuvel CLI** which can actually scaffold a complete runnable project with all feature bundles.

### Capabilities

| Feature | What it does |
|---------|-------------|
| **Scaffold from description** | Describe your agent in natural language → get a complete runnable project |
| **Composio integrations** | 250+ tools (GitHub, Gmail, Slack, Sheets, Notion, Jira, and more) |
| **Channel gateways** | Deploy to Slack, Telegram, or Teams |
| **Self-rewriting persona** | Agents with a SOUL.md that evolves through use |
| **Workflow graphs** | ADK 2.0 Workflow for complex pipelines |
| **ACP adapter** | Agent Client Protocol for editor integration |
| **Eval suites** | evalv2 test suites for validation |

## Quick Start

```bash
# Install Nuvel CLI
pip install nuvel-cli

# Create an agent
nuvel agent create my-agent \
  --description "A customer support agent" \
  --with-composio --with-slack --persona

# Run it
cd generated-agents/my-agent
pip install -r requirements.txt
DEV_MODE=true python run_adk.py
```

## Architecture

```
User describes agent → Nuvel Agent Builder → Nuvel CLI scaffolds
                                                  ↓
                                        Complete ADK agent project
                                        (FastAPI, plugins, integrations)
                                                  ↓
                                        Deploy to Railway or self-host
```

## Resources

- [Nuvel GitHub](https://github.com/Folken2/nuvel)
- [Google ADK Documentation](https://adk.dev/)
- [Agent Directory](https://agentdirectory.folch.ai)