# Generator Pattern

## When to Use

Use Generator when the agent produces **structured artifacts** from reusable templates:
- Reports, summaries, analyses
- Emails, notifications, messages
- Configuration files, manifests
- Code scaffolds, boilerplate
- Contracts, proposals, specifications

The skill provides **fill-in-the-blank templates** and formatting rules. The agent fills in details based on user input and context.

## Architecture

```
User Request ("generate a weekly report")
    ↓
Agent loads Generator skill (L2: template selection + formatting rules)
    ↓
Agent loads template reference (L3: specific template for this artifact type)
    ↓
Agent fills in template sections with:
  - User-provided data
  - Tool outputs (API calls, DB queries)
  - Context from memory/session
    ↓
Structured Output (formatted report, email, config, etc.)
```

## Key Principles

1. **Templates are reusable** — define the structure once, fill differently each time.
2. **Sections are optional** — not every field applies every time. Mark required vs optional.
3. **Output format is specified** — Markdown, JSON, YAML, HTML, plain text.
4. **Tone and style rules** — define voice, formality level, audience.
5. **Examples in references** — show complete filled-in examples, not just empty templates.

## Skeleton Template

### SKILL.md

```markdown
---
name: {{artifact}}-template
description: >-
  Generates structured {{artifact}} documents following the standard template.
  Load when the user asks to create, draft, or produce a {{artifact}}.
---

# {{Artifact}} Generator

## When to Generate
- User explicitly asks for a {{artifact}}.
- A workflow step requires a {{artifact}} as output.

## Template Selection
Choose the right template based on context:
| Situation | Template | Reference |
|-----------|----------|-----------|
| {{situation_1}} | {{template_1}} | Load `{{ref_1}}` |
| {{situation_2}} | {{template_2}} | Load `{{ref_2}}` |

## Formatting Rules
- **Format:** {{Markdown / JSON / YAML / plain text}}
- **Tone:** {{Professional / casual / technical}}
- **Audience:** {{Who reads this}}
- **Length:** {{Expected length range}}

## Required Sections
Every {{artifact}} must include:
1. **{{Section 1}}** — {{what goes here}}
2. **{{Section 2}}** — {{what goes here}}
3. **{{Section 3}}** — {{what goes here}}

## Optional Sections
Include when relevant:
- **{{Optional 1}}** — {{when to include}}
- **{{Optional 2}}** — {{when to include}}

## Quality Checks
Before returning the {{artifact}}:
1. All required sections are present and filled.
2. No placeholder text remains (no "TBD", "TODO", "{{...}}").
3. Tone matches the specified audience.
4. Length is within the expected range.

## References
- Load `{{ref_1}}` for the {{template_1}} template with a filled example.
- Load `{{ref_2}}` for the {{template_2}} template with a filled example.
```

### references/{{ref_1}}.md

```markdown
# {{Template 1}} Template

## Empty Template

\```markdown
# {{Artifact Title}}

**Date:** {{date}}
**Author:** {{author}}

## {{Section 1}}
{{content}}

## {{Section 2}}
{{content}}

## {{Section 3}}
{{content}}
\```

## Filled Example

\```markdown
# Weekly Engineering Report

**Date:** 2026-04-08
**Author:** Platform Team

## Summary
Shipped the new auth middleware and resolved 3 P1 bugs in the payment pipeline.

## Completed Work
- AUTH-234: Migrated session tokens to encrypted store (compliance requirement)
- PAY-567: Fixed race condition in refund processing
- PAY-589: Added retry logic for gateway timeouts

## Blockers
- Waiting on legal review for the new data retention policy (blocks AUTH-240)
\```
```

## Real-World Example

An email drafting agent would have:
- `email-templates/SKILL.md` — template selection (welcome, follow-up, escalation), tone rules, formatting
- `email-templates/references/welcome-email.md` — welcome email template + filled example
- `email-templates/references/escalation-email.md` — escalation template with severity mapping
