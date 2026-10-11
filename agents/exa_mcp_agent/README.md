# EXA MCP Agent

An AI assistant that uses EXA AI's MCP (Model Context Protocol) server to search the web and ground answers with citations. Built with Google ADK, EXA AI MCP, and OpenRouter.

## Quick Start

```bash
# 1. Install dependencies
uv sync --no-install-project

# 2. Set up API keys in .env file
OPENROUTER_API_KEY=your_key_here
EXA_API_KEY=your_key_here
FAST_MODEL=openrouter/google/gemini-3.8-flash  # Optional

# 3. Run the web interface
adk web
```

**Get API Keys:**

- [OpenRouter](https://openrouter.ai/keys) - for the LLM
- [EXA AI](https://dashboard.exa.ai/) - for web search

## Usage

### Web Interface

```bash
adk web
```

Opens a browser interface to chat with your agent.

### Python

```python
from exa_mcp_agent.agent import root_agent

response = root_agent.run("What are the latest AI developments?")
print(response)
```

## Project Structure

```text
exa_mcp_agent/
├── agent.py              # Main agent definition with EXA MCP integration
├── config/
│   ├── llm.py           # LLM configuration
│   └── utils.py         # MCP tool handling utilities
├── prompt/
│   └── prompt.py        # Agent instructions
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

1. User asks a question
2. Agent uses EXA AI MCP server to search the web
3. MCP tools are dynamically loaded at runtime via callback
4. Agent synthesizes answer from search results
5. Returns answer with sources (🔗)

## MCP Integration

This agent uses the EXA AI MCP server to access web search capabilities. The MCP connection:
- Connects to EXA AI's MCP endpoint via HTTPS
- Dynamically loads available tools at runtime
- Provides web search and content extraction capabilities
- Requires `EXA_API_KEY` environment variable

## Example Response

```text
[Answer based on search results]

---

## 🔗 Sources

1. [Title](URL1)
2. [Title](URL2)
```

## Resources

- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [ADK GitHub Repository](https://github.com/google/adk)
- [EXA AI Docs](https://docs.exa.ai/)
- [OpenRouter Models](https://openrouter.ai/models)
