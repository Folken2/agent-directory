# SkillToolset Wiring

How to wire skills into an ADK agent using `SkillToolset`.

## Auto-Discovery from Directory

The standard pattern: scan the `skills/` directory, load every valid skill, and create a `SkillToolset`.

```python
import logging
import pathlib

from google.adk.agents import LlmAgent
from google.adk.skills import load_skill_from_dir
from google.adk.tools.skill_toolset import SkillToolset

logger = logging.getLogger(__name__)

_SKILLS_DIR = pathlib.Path(__file__).parent / "skills"


def _build_skill_toolset() -> SkillToolset | None:
    """Load all skills from the skills directory and return a SkillToolset."""
    skills = []
    if not _SKILLS_DIR.is_dir():
        logger.info("No skills directory found at %s", _SKILLS_DIR)
        return None

    for skill_dir in sorted(_SKILLS_DIR.iterdir()):
        if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
            try:
                skill = load_skill_from_dir(skill_dir)
                skills.append(skill)
                logger.info("Loaded skill: %s", skill_dir.name)
            except Exception as e:
                logger.warning("Failed to load skill %s: %s", skill_dir.name, e)

    if not skills:
        logger.info("No valid skills found in %s", _SKILLS_DIR)
        return None

    return SkillToolset(skills=skills)


# Build the agent with skills
skill_toolset = _build_skill_toolset()

root_agent = LlmAgent(
    name="my_agent",
    model="gemini-2.0-flash",
    instruction="You are a helpful assistant. Use list_skills to see available skills.",
    tools=[skill_toolset] if skill_toolset else [],
)
```

## Auto-Generated Tools

When you create a `SkillToolset`, the framework automatically generates three tools that the LLM can call:

### `list_skills` (L1)

Returns the name and description of all loaded skills. The LLM calls this to decide which skill to load.

```
User: "I need to review this code for security issues"
LLM thinks: Let me check available skills...
LLM calls: list_skills()
→ Returns:
  - security-review: "OWASP Top 10 security review checklist..."
  - api-integration: "Building REST API wrapper tools..."
  - data-pipeline: "Validates ETL pipeline configurations..."
LLM thinks: security-review is relevant, let me load it.
```

### `load_skill(skill_name)` (L2)

Returns the full instructions body of the named skill.

```
LLM calls: load_skill("security-review")
→ Returns the full markdown instructions from SKILL.md
```

### `load_skill_resource(skill_name, resource_filename)` (L3)

Returns the content of a reference file from the skill's `references/` directory.

```
LLM calls: load_skill_resource("security-review", "owasp-checklist.md")
→ Returns the full content of references/owasp-checklist.md
```

## Inline Skill Definition

For programmatically generated skills (e.g., when the meta-agent creates skills on the fly), use the `models` API instead of files on disk:

```python
from google.adk.skills import models

# Define a skill in code
greeting_skill = models.Skill(
    frontmatter=models.Frontmatter(
        name="greeting-skill",
        description="A friendly greeting skill for different cultures and occasions.",
    ),
    instructions="""\
# Greeting Skill

## Steps

1. Identify the user's cultural context from their language or explicit mention.
2. Select an appropriate greeting based on time of day and formality level.
3. Deliver the greeting with the user's name if available.

## References

- Load `greetings-database` for greetings in 20+ languages.
""",
    resources=models.Resources(
        references={
            "greetings-database.md": """\
# Greetings Database

| Language | Formal | Informal |
|----------|--------|----------|
| English | Good morning/afternoon/evening | Hey, Hi |
| Spanish | Buenos dias/tardes/noches | Hola, Que tal |
| Japanese | Ohayou gozaimasu / Konnichiwa | Yaa, Ossu |
| French | Bonjour / Bonsoir | Salut, Coucou |
"""
        }
    ),
)

# Use in a SkillToolset
toolset = SkillToolset(skills=[greeting_skill])
```

## Combining Skills with Regular Tools

Skills and regular `FunctionTool` instances can coexist in the same agent:

```python
from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool
from google.adk.tools.skill_toolset import SkillToolset

# Regular tools
def get_time(tool_context) -> dict:
    """Get the current time."""
    import datetime
    return {"status": "success", "time": str(datetime.datetime.now())}

get_time_tool = FunctionTool(func=get_time)

# Skill toolset
skill_toolset = _build_skill_toolset()

# Combine both
all_tools = [get_time_tool]
if skill_toolset:
    all_tools.append(skill_toolset)

agent = LlmAgent(
    name="combined_agent",
    model="gemini-2.0-flash",
    instruction="You are a helpful assistant with tools and skills.",
    tools=all_tools,
)
```

## Common Pitfalls

1. **Forgetting to add `SkillToolset` to the `tools` list** — skills are loaded but the LLM has no way to access them.
2. **Duplicate skill names** — each skill `name` must be unique. The toolset will use the last one loaded.
3. **Missing `SKILL.md`** — a directory without `SKILL.md` is silently skipped.
4. **Referencing nonexistent resources** — if instructions say "Load `foo.md`" but `references/foo.md` doesn't exist, `load_skill_resource` will return an error.
