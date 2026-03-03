# Agent Directory

Welcome to the **Agent Directory** repository! This collection provides production-ready AI agents built on top of the [Agent Development Kit (ADK)](https://github.com/google/adk), designed to showcase various agent patterns, capabilities, and integrations.

## What's Inside

- 🤖 **Production-Ready Agents**: Battle-tested agents covering web search, research, image generation, and more
- 🌐 **Next.js Web UI**: Full-featured frontend with agent chat, community posts, Google OAuth, and more
- 🧩 **Plugin System**: Server-level plugins for logging, error recovery, and more — applied globally to every agent run
- 🔌 **Standard API**: All agents expose a consistent HTTP API for easy integration
- 🌐 **Live Testing**: All agents are live and testable at **[agentdirectory.folch.ai](https://agentdirectory.folch.ai)**
- 📋 **Metadata-Driven**: Agents are automatically discovered and displayed based on `metadata.json` files
- 📦 **Open Source**: MIT licensed and ready for contributions

> 🌐 **Live Demo**: Test all agents in this repository at **[agentdirectory.folch.ai](https://agentdirectory.folch.ai)**. The website automatically discovers and displays agents based on their `metadata.json` files, making proper metadata configuration essential for your agent to appear correctly.

## Getting Started

This repository contains ADK sample agents for **Python**. Each agent is self-contained with its own configuration, tools, and documentation. Navigate to individual agent directories to see setup instructions and learn more about specific capabilities.

> [!IMPORTANT]
> The agents in this repository are built using the **Agent Development Kit (ADK)**. Before you can run any of the samples, you must have the ADK installed. For instructions, please refer to the [**ADK Installation Guide**](https://github.com/google/adk).

> [!NOTE]
> **Metadata is Essential**: For your agent to appear correctly on [agentdirectory.folch.ai](https://agentdirectory.folch.ai), you must include a properly formatted `metadata.json` file in your agent directory. See [AGENT_METADATA.md](./AGENT_METADATA.md) for the complete metadata specification.

To learn more, check out the [ADK Documentation](https://github.com/google/adk) and the [ADK Python repository](https://github.com/google/adk-python).

## Server-Level Plugins

The Agent Directory includes a **plugin system** that applies cross-cutting concerns to every agent run automatically. Plugins are registered at the server level in `run_adk.py` via ADK's `extra_plugins` mechanism — no changes needed in individual agents.

### Included Plugins

| Plugin | What it does |
|--------|-------------|
| **ConsoleLoggerPlugin** | Pretty, color-coded terminal output for every agent lifecycle event — LLM requests/responses, tool calls, errors, timing. Makes debugging a breeze. |
| **SelfHealingToolPlugin** | Automatic error recovery for tool failures. Detects errors hidden in successful responses (common with MCP tools), reflects the error back to the LLM with suggestions, and retries up to 3 times before gracefully falling back. |

### Adding Your Own Plugin

1. Create a new file in `plugins/` (e.g. `plugins/my_plugin.py`)
2. Extend `BasePlugin` from `google.adk.plugins.base_plugin`
3. Instantiate a singleton at module level
4. Add its qualified name to `PLUGIN_QUALIFIED_NAMES` in `plugins/__init__.py`

That's it — your plugin will automatically apply to all agents on the next deploy.

## Frontend (adk-web-ui)

The `adk-web-ui/` directory contains the **Next.js frontend** that powers [agentdirectory.folch.ai](https://agentdirectory.folch.ai).

**Tech stack:** Next.js 16, React 19, Tailwind CSS 4, Drizzle ORM, NextAuth (Google OAuth), Zustand, Neon (PostgreSQL)

**Key features:**
- Agent discovery and chat interface with SSE streaming
- Google OAuth authentication
- Community trending posts with likes
- Rate limiting for anonymous and authenticated users
- Mermaid diagram rendering, artifact display, and more

**Running locally:**

```bash
cd adk-web-ui
npm install
cp .env.example .env.local  # Configure your environment variables
npm run dev                  # Starts on http://localhost:3000
```

The frontend connects to the backend via `NEXT_PUBLIC_ADK_SERVER_URL` (defaults to `http://localhost:8000`).

## Repository Structure

This is a **monorepo** containing both the Python backend (ADK agents) and the Next.js frontend.

```
.
├── agents/                      # Python backend — ADK agents
│   ├── adk_agent_builder/      # Meta-agent for building agents
│   ├── data_analyst_agent/     # Code execution & data analysis
│   ├── exa_mcp_agent/          # EXA AI research agent
│   ├── image_generation_agent/ # Image generation agent
│   ├── mermaid_mcp_agent/      # Mermaid diagram generator
│   ├── resume_screener/        # Multi-agent resume screener
│   ├── simple_agent_maps_grounded/ # Maps-integrated agent
│   ├── simple_agent_web_search/ # Basic web search agent
│   ├── tavily_mcp_agent/       # Tavily research agent
│   ├── pyproject.toml          # Python dependencies
│   └── uv.lock                 # Lock file
├── adk-web-ui/                  # Next.js frontend
│   ├── app/                    # App router pages & API routes
│   ├── components/             # React components
│   ├── lib/                    # Utilities, auth, DB, state
│   ├── drizzle/                # Database migrations
│   ├── package.json            # Node dependencies
│   └── next.config.ts          # Next.js configuration
├── plugins/                     # Server-level plugins
│   ├── __init__.py             # Plugin registry
│   ├── console_logger.py      # Terminal logging plugin
│   └── circuit_breaker.py     # Self-healing error recovery
├── run_adk.py                  # Backend server entrypoint
├── Dockerfile                  # Backend Docker configuration
├── railway.json                # Railway deployment config
├── AGENT_METADATA.md           # Metadata specification
├── metadata.json.template      # Metadata template
└── LICENSE                     # License file
```

Each agent directory contains:
- `agent.py` - Main agent definition
- `config/` - Configuration and LLM setup
- `prompt/` - Agent instructions and prompts
- `tools/` - Custom tools and integrations
- `metadata.json` - **Required** agent metadata for website integration
- `README.md` - Agent-specific documentation and setup instructions

> [!IMPORTANT]
> The `metadata.json` file is **required** for your agent to appear correctly on [agentdirectory.folch.ai](https://agentdirectory.folch.ai). The website automatically discovers agents and displays them based on this metadata. See [AGENT_METADATA.md](./AGENT_METADATA.md) for the complete specification.

## API Overview

All agents expose a standard HTTP API through the ADK server. The server provides:

- **Agent Discovery**: `GET /list-apps` - List available agents
- **Agent Execution**: `POST /run` - Run agent (non-streaming)
- **Streaming**: `POST /run_sse` - Run agent with Server-Sent Events
- **Session Management**: Create and manage conversation sessions
- **Artifacts**: Access generated files, images, and structured outputs

For detailed API documentation, see the [ADK documentation](https://github.com/google/adk).

## Getting Help

If you have any questions or if you found any problems with this repository, please report through [GitHub issues](https://github.com/albertfolch/adk-agents/issues).

## Contributing

We welcome contributions from the community! Whether it's bug reports, feature requests, documentation improvements, or code contributions, we'd love to have your agent included in the Agent Directory.

### How to Contribute an Agent

1. **Fork and Clone**: Fork this repository and clone your fork locally
2. **Create Your Agent**: Develop your agent following the ADK structure and best practices
3. **Add Metadata**: Create a `metadata.json` file with complete agent information (required for the website to display your agent)
4. **Add Documentation**: Include a `README.md` with setup and usage instructions
5. **Submit Pull Request**: Create a pull request with your agent for review

### Required Folder Structure

When contributing an agent, ensure your agent directory follows this structure:

```
agent_name/
├── agent.py              # Main agent definition (required)
├── metadata.json         # Agent metadata (required)
├── README.md            # Documentation and setup instructions (recommended)
├── config/              # Configuration files
│   ├── __init__.py
│   ├── llm.py          # LLM configuration
│   └── utils.py        # Utility functions
├── prompt/              # Agent prompts and instructions
│   ├── __init__.py
│   └── prompt.py       # Main prompt definition
└── tools/               # Custom tools and integrations
    ├── __init__.py
    └── your_tool.py    # Tool implementations
```

**Required Files:**
- `agent.py` - Main agent implementation
- `metadata.json` - Complete agent metadata (see [AGENT_METADATA.md](./AGENT_METADATA.md))

**Recommended Files:**
- `README.md` - Setup instructions, usage examples, and documentation
- `config/` - Configuration and LLM setup
- `prompt/` - Agent instructions and prompts
- `tools/` - Custom tools and integrations

For detailed contribution instructions, including metadata templates and submission guidelines, see the [Contribution Guide](https://agentdirectory.folch.ai/contribute).

### Contribution Requirements

When contributing:
- Add appropriate documentation
- Include tests for new features
- **Ensure `metadata.json` is complete and accurate** - this is critical for your agent to appear on the website

## Resources

- **[Live Agent Directory](https://agentdirectory.folch.ai)** - Test all agents in this repository
- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [ADK Python Repository](https://github.com/google/adk-python)
- [Contribution Guide](https://agentdirectory.folch.ai/contribute) - Learn how to submit your agent

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Disclaimers

This is not an officially supported Google product. This project is intended for demonstration and educational purposes.
