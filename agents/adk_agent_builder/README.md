# ADK Agent Builder

A specialist AI assistant that helps users build agents using the Google Agent Development Kit (ADK). The agent is grounded in a **curated library of ADK skills shipped inside the agent package** — no external doc fetches at runtime — so it works the same locally and in deployed environments.

## Overview

The ADK Agent Builder is a meta-agent that helps you build other agents. It acts as an expert consultant and mentor, providing:

- **Architectural Guidance**: From simple single-agent setups to complex multi-agent orchestrations
- **Code Examples**: Working code snippets and complete examples
- **Best Practices**: ADK patterns, anti-patterns, and recommendations
- **Troubleshooting**: Debug help and solutions for common issues
- **Skill-grounded answers**: Every substantive answer is queried against the bundled ADK skills

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

## Knowledge — bundled ADK skills

Instead of fetching pages from `adk.dev` at runtime, this agent loads a curated set of `SKILL.md` files via ADK's `SkillToolset`. The skills live in `skills/` next to `agent.py` and ship with the package.

| Skill | Use it for |
| --- | --- |
| `adk-agent-patterns` | Choosing between `LlmAgent`, `LoopAgent`, `SequentialAgent`, `ParallelAgent`, multi-agent hierarchies |
| `adk-tool-creation` | Writing function tools, `ToolContext`, structured returns, error handling |
| `adk-prompt-engineering` | System prompt design, dynamic `InstructionProvider`, prompt versioning |
| `adk-callbacks-hitl` | `before/after` callbacks, human-in-the-loop gates, state management |
| `adk-streaming` | Voice / video agents on the Gemini Live API |
| `adk-skill-creation` | Authoring your own `SKILL.md` for an agent's domain knowledge |
| `adk-skill-design-patterns` | The five canonical SKILL.md shapes — pick before authoring |

The agent queries the `SkillToolset` with focused questions; the toolset returns the relevant skill content rather than dumping it into the system prompt, keeping context usage small.

## Example Use Cases

### 1. Building a Simple Agent

**User**: "I want to create an agent that searches the web and summarizes results"

The Agent Builder queries `adk-agent-patterns` and `adk-tool-creation`, then recommends a single `LlmAgent` with `google_search`, with a complete code example.

### 2. Multi-Agent System Design

**User**: "I need an agent that processes data and then generates a report"

It queries `adk-agent-patterns` and recommends a `SequentialAgent` pipeline, mapping out session-state communication between sub-agents.

### 3. Tool Integration

**User**: "How do I add a custom API tool to my agent?"

It queries `adk-tool-creation` and walks through `FunctionTool` patterns, `ToolContext` use, and structured return shapes.

### 4. Human-in-the-loop

**User**: "How do I require approval before a destructive action?"

It queries `adk-callbacks-hitl` and shows the `before_tool_callback` pattern with state-driven approval.

## Project Structure

```text
adk_agent_builder/
├── agent.py              # Builds SkillToolset from skills/ and wires the agent
├── config/
│   ├── llm.py           # LLM configuration
│   └── utils.py         # Tool-rendering callback that injects tool descriptions into the prompt
├── prompt/
│   └── prompt.py        # Specialist prompt for agent building
├── skills/              # Bundled ADK skills (SKILL.md + references/)
│   ├── adk-agent-patterns/
│   ├── adk-tool-creation/
│   ├── adk-prompt-engineering/
│   ├── adk-callbacks-hitl/
│   ├── adk-streaming/
│   ├── adk-skill-creation/
│   └── adk-skill-design-patterns/
├── metadata.json        # Agent metadata for web UI
└── README.md            # This file
```

## How It Works

1. On import, `agent.py` walks `skills/`, calls `load_skill_from_dir` on each subdirectory containing a `SKILL.md`, and wraps the result in a `SkillToolset`.
2. The agent's prompt instructs it to query the skill toolset before answering substantive ADK questions.
3. The before-agent callback (`before_agent_callback_update_tools`) discovers the loaded tools at runtime and rewrites the instruction to include their descriptions.

The skills directory path is resolved as `pathlib.Path(__file__).parent / "skills"`, so the agent works in any deployment without needing env vars or filesystem mounts.

## Customization

### Add or edit skills

Drop a new directory under `skills/` containing a `SKILL.md` (with frontmatter `name:` and `description:` at minimum). It will be picked up on the next agent boot.

### Change LLM Model

Edit `config/llm.py`:

```python
FAST_MODEL = LiteLlm(
    model="openrouter/google/gemini-3-flash-preview",
    app_name="adk-samples-directory",
)
```

### Modify Prompt

Edit `prompt/prompt.py` (`prompt_v1`) to customize behavior. The codebase uses versioned prompts — bump to `prompt_v2` for substantive changes.

## Resources

- [Google ADK Documentation](https://adk.dev/)
- [ADK GitHub Repository](https://github.com/google/adk)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)

## Notes

- All ADK guidance is grounded in the bundled skills — the agent does not fetch external docs at runtime
- Skills are queryable via the `SkillToolset`, not preloaded into the system prompt
- The agent recommends the simplest architecture first and warns against over-engineering
