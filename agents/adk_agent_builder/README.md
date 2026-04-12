# ADK Agent Builder

A specialist AI assistant that helps users build agents using the Google Agent Development Kit (ADK). This agent has access to the complete ADK documentation through MCP (Model Context Protocol) and provides expert guidance on agent design, implementation, and best practices.

## Overview

The ADK Agent Builder is a meta-agent - an agent that helps you build other agents. It acts as an expert consultant and mentor, providing:

- **Architectural Guidance**: Help designing agent systems, from simple single-agent setups to complex multi-agent orchestrations
- **Code Examples**: Working code snippets and complete examples
- **Best Practices**: ADK patterns, anti-patterns, and recommendations
- **Troubleshooting**: Debug help and solutions for common issues
- **Documentation Access**: Direct access to ADK documentation for accurate, up-to-date information

## Quick Start

```bash
# 1. Install dependencies
uv sync --no-install-project

# 2. Set up environment variables in .env file (if needed)
FAST_MODEL=openrouter/google/gemini-3-flash-preview
REASONING_MODEL=openrouter/google/gemini-3-pro-preview

# 3. Run the web interface
adk web
```

## Usage

### Web Interface

```bash
adk web
```

Opens a browser interface to chat with the agent builder.

### Python

```python
from adk_agent_builder.agent import root_agent

response = root_agent.run("Help me build a simple web search agent")
print(response)
```

## Features

### Expert Guidance

- **Simple to Complex**: Guides you from simple single-agent setups to complex multi-agent systems
- **Architecture Design**: Helps design agent hierarchies and communication patterns
- **Tool Integration**: Explains built-in tools, function tools, and MCP tools
- **Best Practices**: Shares ADK patterns and warns against anti-patterns

### Documentation Access

- **Complete ADK Docs**: Access to the full ADK documentation via MCP
- **Accurate Information**: Always references official documentation
- **Up-to-Date**: Uses latest ADK patterns and APIs

### Practical Help

- **Code Examples**: Provides complete, working code examples
- **Troubleshooting**: Helps debug errors and issues
- **Configuration**: Guides on deployment and configuration

## Example Use Cases

### 1. Building a Simple Agent

**User**: "I want to create an agent that searches the web and summarizes results"

**Agent Builder** will:
- Recommend using `LlmAgent` with `google_search` tool
- Provide complete code structure
- Explain configuration and deployment
- Show best practices for prompts

### 2. Multi-Agent System Design

**User**: "I need an agent that processes data and then generates a report"

**Agent Builder** will:
- Recommend `SequentialAgent` with specialized sub-agents
- Map out session state communication
- Show how to structure the workflow
- Explain data flow between agents

### 3. Tool Integration

**User**: "How do I add a custom API tool to my agent?"

**Agent Builder** will:
- Explain `FunctionTool` creation
- Show integration patterns
- Explain tool distribution rules
- Provide complete examples

### 4. Troubleshooting

**User**: "My agent is giving me an error about built-in tools"

**Agent Builder** will:
- Help identify the issue
- Reference ADK constraints (one built-in tool per agent)
- Provide solutions
- Suggest alternative architectures

## Project Structure

```text
adk_agent_builder/
├── agent.py              # Main agent definition with ADK docs MCP
├── config/
│   ├── llm.py           # LLM configuration
│   └── utils.py         # MCP tool handling utilities
├── prompt/
│   └── prompt.py        # Specialist prompt for agent building
├── metadata.json        # Agent metadata for web UI
└── README.md            # This file
```

## How It Works

1. **User asks a question** about building ADK agents
2. **Agent Builder** uses ADK docs MCP to fetch relevant documentation
3. **Provides expert guidance** based on ADK patterns and best practices
4. **Offers code examples** and architectural recommendations
5. **Helps troubleshoot** any issues or errors

## MCP Integration

This agent uses [mcpdoc](https://github.com/modelcontextprotocol/servers) (via `uvx`) with the ADK `llms.txt` index from **`https://raw.githubusercontent.com/google/adk-docs/main/llms.txt`**.

**Why not `google.github.io/adk-docs/llms.txt`?** That URL returns **301** to `https://adk.dev/llms.txt`. HTTP clients that do not follow redirects (common in locked-down doc fetchers) fail before any content loads. The raw GitHub URL serves the same file with **200** and no redirect. Fallback if your environment blocks `raw.githubusercontent.com`: `https://adk.dev/llms.txt` (also **200**, no redirect).

Doc pages linked from the index use **`https://adk.dev/...`** (HTTP 200). Rewriting those links to `google.github.io/adk-docs/...` is wrong: GitHub Pages **also** 301-redirects to `adk.dev`, so the same redirect failure can occur.

The MCP connection allows the agent to:

- Fetch the index and specific documentation pages (prefer `adk.dev` URLs as listed in the index)
- Provide accurate, up-to-date guidance
- Reference official ADK patterns and APIs

## Customization

### Change LLM Model

Edit `config/llm.py`:

```python
FAST_MODEL = LiteLlm(
    model="openrouter/google/gemini-3-flash-preview",  # Change model here
    app_name="adk-samples-directory",
)
```

### Modify Prompt

Edit `prompt/prompt.py` to customize the agent's behavior and expertise:

```python
prompt_v0 = """
Your custom instructions here...
"""
```

## Resources

- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [ADK GitHub Repository](https://github.com/google/adk)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)

## Notes

- The agent uses ADK documentation via MCP for accurate information
- Always references official docs when providing guidance
- Focuses on best practices and avoiding common pitfalls
- Provides complete, working code examples when possible

