# Inversion Pattern

## When to Use

Use Inversion when the agent handles **ambiguous, open-ended, or high-stakes requests** where guessing wrong is costly:
- Project planning — scope, timeline, priorities are unclear
- Creative work — design, writing, branding where preferences matter
- Configuration — complex setups with many valid options
- Diagnosis — debugging, troubleshooting where symptoms are ambiguous
- Any request where the user's first message lacks critical details

The skill **inverts control** — instead of the agent guessing and acting, it interviews the user first to gather the information it needs.

## Architecture

```
User Request (ambiguous: "build me an agent")
    ↓
Agent loads Inversion skill (L2: interview protocol)
    ↓
Agent checks: which required fields are missing?
    ↓
Agent asks clarifying question #1
    ↓ (user responds)
Agent asks clarifying question #2
    ↓ (user responds)
... (until all required fields are answered or user says "just do it")
    ↓
Agent has enough context → proceeds with action
```

## Key Principles

1. **Define required vs optional fields** — know what you MUST ask vs what's nice to have.
2. **One question at a time** — don't overwhelm the user with a questionnaire.
3. **Prefer multiple choice** — easier for users than open-ended when possible.
4. **Skip answered questions** — if the user's initial message covers a field, don't re-ask.
5. **Have an escape hatch** — if the user says "just do it", use sensible defaults.
6. **Summarize before acting** — confirm your understanding before proceeding.

## Skeleton Template

### SKILL.md

```markdown
---
name: {{domain}}-interview
description: >-
  Interview protocol for gathering requirements before {{action}}.
  Load when the user's request is ambiguous or missing critical details
  about {{domain}}.
---

# {{Domain}} Interview

## When to Interview
- User's request is missing 2+ required fields.
- The request involves high-stakes decisions (irreversible, expensive, public-facing).
- The domain has multiple valid approaches and the user hasn't specified a preference.

## Do NOT Interview When
- The user has provided a comprehensive brief covering all required fields.
- The user explicitly says "just do it" or "use defaults".
- This is a follow-up to a previous conversation where requirements were already gathered.

## Required Fields

| Field | Question | Default (if skipped) |
|-------|----------|---------------------|
| {{field_1}} | {{question_1}} | {{default_1}} |
| {{field_2}} | {{question_2}} | {{default_2}} |
| {{field_3}} | {{question_3}} | {{default_3}} |

## Optional Fields

| Field | Question | When to Ask |
|-------|----------|-------------|
| {{opt_field_1}} | {{question}} | {{condition}} |
| {{opt_field_2}} | {{question}} | {{condition}} |

## Interview Flow

1. Read the user's initial message carefully.
2. Check which required fields are already answered.
3. For each unanswered required field, ask **one question at a time**.
4. Use multiple choice when there are ≤5 valid options:
   > "Which approach do you prefer?
   > A) {{option_1}} — {{tradeoff}}
   > B) {{option_2}} — {{tradeoff}}
   > C) {{option_3}} — {{tradeoff}}"
5. After all required fields are answered, ask optional fields only if relevant.
6. Summarize your understanding before proceeding:
   > "Here's what I'll do: {{summary}}. Sound good?"
7. Proceed with the action.

## Escape Hatch

If the user says "just do it", "use defaults", or shows impatience:
1. Stop asking questions immediately.
2. Fill remaining fields with defaults from the Required Fields table.
3. State what defaults you're using:
   > "Using defaults: {{field_1}}={{default_1}}, {{field_2}}={{default_2}}. Proceeding."

## References

- Load `question-bank` for the complete list of questions with rationale and examples.
```

### references/question-bank.md (optional)

```markdown
# {{Domain}} Question Bank

## {{Field 1}}: {{Name}}

**Why we ask:** {{Rationale — what goes wrong if we guess}}

**Question (open-ended):** "{{open_question}}"

**Question (multiple choice):**
> {{mc_question}}
> A) {{option}} — {{tradeoff}}
> B) {{option}} — {{tradeoff}}
> C) {{option}} — {{tradeoff}}

**Example good answer:** "{{example}}"
**Default if skipped:** {{default}}

---

## {{Field 2}}: {{Name}}
...
```

## Real-World Example

A project planning agent would have:
- `requirements-interview/SKILL.md` — required fields: goal, users, timeline, budget, constraints
- `requirements-interview/references/question-bank.md`:
  - Goal: "What problem are you trying to solve?" (open-ended, no default — must ask)
  - Users: "Who will use this? A) Internal team B) Customers C) Both" (multiple choice)
  - Timeline: "When do you need this? A) This week B) This month C) No rush" (default: "no rush")
  - Budget: Only ask if the project involves paid services/infrastructure

Our meta-agent already uses this pattern in Step 1 (Discovery). Generated agents should learn it too — especially agents that handle complex, ambiguous requests.
