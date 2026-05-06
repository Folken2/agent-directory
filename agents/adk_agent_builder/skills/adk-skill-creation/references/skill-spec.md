# agentskills.io Specification Summary

## Directory Structure

```
skills/
  <skill-name>/
    SKILL.md                # Required — skill definition
    references/             # Optional — L3 reference files
      *.md
    assets/                 # Optional — images, data files
    scripts/                # Optional — executable scripts
```

## SKILL.md Format

```yaml
---
# REQUIRED fields
name: kebab-case-name        # Max 64 characters, [a-z0-9-]
description: >-              # Max 1024 characters
  What the skill does and when to use it.

# OPTIONAL fields (not commonly used)
# version: 1.0.0
# tags: [python, security]
# author: your-name
---

Markdown body here — the L2 instructions.
```

## Frontmatter Schema

### Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | kebab-case, max 64 chars, `[a-z0-9-]` | Unique identifier for the skill |
| `description` | string | Max 1024 characters | L1 metadata — shown to LLM for skill selection |

### Naming Rules

- Must be kebab-case: `my-skill-name`
- Only lowercase letters, numbers, and hyphens
- Max 64 characters
- Must be unique within the skills directory
- Must match the directory name

### Description Rules

- Max 1024 characters (hard limit)
- Should answer: "When should the LLM load this skill?"
- Include the trigger condition: "Load this skill when..."
- Be specific about the domain and use case
- Avoid generic phrases ("helpful", "useful", "good")

## Instructions Body

The markdown body after the frontmatter is the L2 content.

### Guidelines

- **Max 500 lines** — move details to references if longer
- Use numbered steps for sequential instructions
- Use headings to organise sections
- Include at least one minimal example or template
- End with a References section listing L3 resources
- Write in imperative mood: "Check X", "Add Y", "Validate Z"

### Recommended Sections

```markdown
# Skill Title

## Overview (optional, 2-3 sentences)

## Steps
1. First step...
2. Second step...

## Quick-Start Template
(minimal working example)

## Common Pitfalls (optional)

## References
- Load `resource-name` for details on X.
```

## References Directory

- Files must be markdown (`.md`)
- Use kebab-case filenames: `api-patterns.md`, `error-handling.md`
- Each file should be focused on one topic
- Include complete, runnable code examples
- Recommended: under 300 lines per file

## Progressive Disclosure Summary

```
L1: name + description     (~100 tokens)  → Always visible via list_skills
L2: SKILL.md body          (~500-2000 tokens) → Loaded via load_skill
L3: references/*.md        (variable)     → Loaded via load_skill_resource
```

The LLM autonomously decides when to load L2 and L3 based on the task at hand. Good L1 descriptions are critical for this to work.

## Size Budget Guidelines

| Component | Recommended Max | Hard Limit |
|-----------|----------------|------------|
| `name` | 30 chars | 64 chars |
| `description` | 500 chars | 1024 chars |
| SKILL.md body | 200 lines | 500 lines |
| Single reference file | 300 lines | None (but larger = slower to load) |
| Total references | 5-10 files | None |
