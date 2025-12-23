# GitHub Workflows

This directory contains GitHub Actions workflows and validation scripts for the agent directory.

## Workflows

### `validate-agents.yml` - Agent Structure Validation

Automatically validates agent directory structure on pull requests that modify files in the `agents/` directory.

**Trigger Events:**
- Pull requests to `main` or `master` branch that modify `agents/**` files
- Manual workflow dispatch

**What it validates:**

#### Required (must pass):
- ✅ `agent.py` exists and is not empty
- ✅ `agent.py` has valid Python syntax
- ✅ `__init__.py` exists
- ✅ `metadata.json` exists and is valid JSON
- ✅ `metadata.json` contains required fields: `name`, `description`, `tools`
- ✅ `metadata.json` `name` field matches directory name exactly
- ✅ `metadata.json` `name` field contains no spaces
- ✅ `metadata.json` `tools` field is an array
- ✅ Directory name is a valid Python identifier (alphanumeric + underscores)

#### Recommended (warnings only):
- ⚠️ `README.md` exists
- ⚠️ `config/llm.py` exists
- ⚠️ `prompt/prompt.py` exists
- ⚠️ `metadata.json` contains recommended fields: `displayName`, `author`, `tags`
- ⚠️ `__init__.py` imports the agent module

## Validation Script

### `validate_agents.py`

Python script that validates agent directory structure.

**Usage:**
```bash
# Validate all agents in the default agents/ directory
python .github/validate_agents.py

# Validate agents in a specific directory
python .github/validate_agents.py /path/to/agents
```

**Output:**
- Colored terminal output showing pass/fail status for each agent
- Detailed error messages for validation failures
- Warning messages for missing recommended files
- Summary with total/passed/failed counts

**Exit codes:**
- `0` - All agents passed validation
- `1` - One or more agents failed validation

## Running Locally

Before submitting a pull request, you can run the validation locally:

```bash
# Make the script executable (one time)
chmod +x .github/validate_agents.py

# Run validation
python3 .github/validate_agents.py agents
```

## Example Output

```
Validating 2 agent(s) in agents

Validation Results
================================================================================

[PASS] my_agent
  Path: agents/my_agent

  Warnings:
    ⚠ README.md is missing (highly recommended)

[FAIL] broken_agent
  Path: agents/broken_agent

  Errors:
    ✗ metadata.json missing required field: 'description'
    ✗ agent.py is missing

================================================================================
Summary:
  Total agents: 2
  Passed: 1
  Failed: 1
```

## Contributing

When adding a new agent, ensure your directory structure includes at minimum:

```
agents/your_agent_name/
├── agent.py         # Main agent implementation
├── __init__.py      # Package initialization
└── metadata.json    # Agent metadata
```

For best practices, also include:
```
agents/your_agent_name/
├── README.md        # Documentation
├── config/
│   └── llm.py      # LLM configuration
└── prompt/
    └── prompt.py   # Agent prompts
```

See [AGENT_METADATA.md](../AGENT_METADATA.md) for the complete metadata specification.
