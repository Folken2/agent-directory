# Mermaid MCP Agent

An AI assistant that uses Mermaid Chart's MCP (Model Context Protocol) server to create and manage diagrams. Built with Google ADK, Mermaid Chart MCP, and OpenRouter.

## Quick Start

```bash
# 1. Install dependencies
uv sync --no-install-project

# 2. Set up API keys in .env file
OPENROUTER_API_KEY=your_key_here
FAST_MODEL=openrouter/google/gemini-3.8-flash  # Optional

# 3. Run the web interface
adk web
```

**Get API Keys:**

- [OpenRouter](https://openrouter.ai/keys) - for the LLM
- Mermaid Chart MCP - No API key required (public MCP server)

## Usage

### Web Interface

```bash
adk web
```

Opens a browser interface to chat with your agent.

### Python

```python
from mermaid_mcp_agent.agent import root_agent

response = root_agent.run("Create a flowchart showing the software development lifecycle")
print(response)
```

## Project Structure

```text
mermaid_mcp_agent/
├── agent.py              # Main agent definition with Mermaid MCP integration
├── config/
│   ├── llm.py           # LLM configuration
│   └── utils.py         # MCP tool handling utilities
├── prompt/
│   └── prompt.py        # Agent instructions
├── tools/
│   ├── rag_search.py    # RAG search tool (if applicable)
│   └── web_search_async.py  # Web search tool (if applicable)
└── metadata.json        # Agent metadata for web UI
```

## Customization

### Change LLM Model

Set `FAST_MODEL` or `REASONING_MODEL` in `.env` (e.g. `FAST_MODEL=openrouter/google/gemini-3.8-flash`).
The defaults and LiteLLM proxy routing live in [`agents/model_factory.py`](../model_factory.py).

Then update `agent.py`:

```python
root_agent = LlmAgent(
    model=FAST_MODEL,  # or REASONING_MODEL
    # ...
)
```

### Modify Prompt

Edit `prompt/prompt.py` to change agent behavior:

```python
prompt_v0 = f"""
You are a helpful AI assistant...
# Your custom instructions here
"""
```

## How It Works

1. User requests a diagram or asks about diagram creation
2. Agent uses Mermaid Chart MCP server to create/manage diagrams
3. MCP tools are dynamically loaded at runtime via callback
4. Agent can create flowcharts, sequence diagrams, class diagrams, etc.
5. Returns diagram code or visualizations

## MCP Integration

This agent uses the Mermaid Chart MCP server to access diagram creation capabilities. The MCP connection:
- Connects to Mermaid Chart's public MCP endpoint
- Dynamically loads available tools at runtime
- Provides diagram creation and management capabilities
- No API key required (public server)

## Example Use Cases

- Create flowcharts for processes
- Generate sequence diagrams for system interactions
- Build class diagrams for software architecture
- Create Gantt charts for project planning
- Generate entity-relationship diagrams

## Resources

- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [ADK GitHub Repository](https://github.com/google/adk)
- [Mermaid Chart](https://www.mermaidchart.com/)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
- [OpenRouter Models](https://openrouter.ai/models)
