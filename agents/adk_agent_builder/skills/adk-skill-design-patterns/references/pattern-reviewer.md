# Reviewer Pattern

## When to Use

Use Reviewer when **output quality matters** and the agent should validate work before returning it:
- Code review — check for bugs, security issues, style violations
- Content moderation — flag inappropriate or off-topic content
- Compliance checks — verify output meets regulatory requirements
- Data validation — check data integrity, completeness, consistency
- Self-assessment — agent reviews its own output before responding

The skill stores a **checklist** in a reference file and the agent scores output against it.

## Architecture

```
Agent produces output (code, text, data, etc.)
    ↓
Agent loads Reviewer skill (L2: review process + severity levels)
    ↓
Agent loads checklist reference (L3: domain-specific checklist)
    ↓
Agent evaluates output against each checklist item
    ↓
Review Result:
  - PASS: Output meets all criteria → return to user
  - FAIL (auto-fixable): Fix issues → re-review
  - FAIL (not fixable): Report issues to user with severity
```

## Key Principles

1. **Checklist-driven** — every review criterion is explicit, not subjective.
2. **Severity levels** — CRITICAL (must fix), WARNING (should fix), INFO (nice to fix).
3. **Actionable feedback** — don't just flag problems, suggest fixes.
4. **Self-review loop** — the agent can review and fix its own output before returning.
5. **Structured output** — review results follow a consistent format.

## Skeleton Template

### SKILL.md

```markdown
---
name: {{domain}}-review
description: >-
  Reviews {{what}} against a structured checklist covering {{categories}}.
  Load when validating {{what}} before returning to the user or before
  executing a sensitive operation.
---

# {{Domain}} Review

## When to Review
- Before returning {{what}} to the user.
- Before executing {{sensitive_operation}}.
- When the user explicitly asks for a review.

## Review Process

1. Load the checklist: `load_skill_resource("{{domain}}-review", "checklist.md")`
2. Evaluate the {{what}} against **every** checklist item.
3. For each item, assign a severity:
   - **CRITICAL** — Must fix before proceeding. Blocks output.
   - **WARNING** — Should fix. Output can proceed with caveats.
   - **INFO** — Nice to have. Note for improvement.
4. If any CRITICAL issues found:
   a. Attempt to fix them automatically.
   b. Re-run the review on the fixed version.
   c. If still failing after 2 attempts, report to user.
5. Return the review summary in structured format.

## Output Format

\```
## Review Summary
- **Status:** PASS / FAIL
- **Critical:** {{count}}
- **Warnings:** {{count}}
- **Info:** {{count}}

### Issues Found
1. [CRITICAL] {{description}} — Fix: {{suggestion}}
2. [WARNING] {{description}} — Fix: {{suggestion}}
3. [INFO] {{description}} — Suggestion: {{suggestion}}
\```

## Self-Review Mode

When reviewing your own output (self-assessment):
1. Generate the output first.
2. Load this skill and run the review.
3. Fix any CRITICAL/WARNING issues.
4. Return the improved output (don't show the review to the user unless asked).

## References

- Load `checklist` for the complete review checklist with examples.
```

### references/checklist.md

```markdown
# {{Domain}} Review Checklist

## {{Category 1}}: {{Name}}

| # | Check | Severity | Example Violation |
|---|-------|----------|-------------------|
| 1 | {{Check description}} | CRITICAL | {{Example of what failing looks like}} |
| 2 | {{Check description}} | WARNING | {{Example}} |
| 3 | {{Check description}} | INFO | {{Example}} |

## {{Category 2}}: {{Name}}

| # | Check | Severity | Example Violation |
|---|-------|----------|-------------------|
| 4 | {{Check description}} | CRITICAL | {{Example}} |
| 5 | {{Check description}} | WARNING | {{Example}} |

## Scoring

- **PASS:** 0 CRITICAL, 0 WARNING
- **CONDITIONAL PASS:** 0 CRITICAL, 1+ WARNING (proceed with notes)
- **FAIL:** 1+ CRITICAL (must fix before proceeding)
```

## Real-World Example

A SQL agent would have:
- `query-review/SKILL.md` — review process for SQL queries, self-review before execution
- `query-review/references/checklist.md`:
  - CRITICAL: SQL injection via string concatenation, missing WHERE on DELETE/UPDATE, dropping tables
  - WARNING: Missing indexes on JOIN columns, SELECT * instead of specific columns, N+1 patterns
  - INFO: Inconsistent aliases, missing comments on complex joins

A content agent would have:
- `content-review/SKILL.md` — review process for generated text
- `content-review/references/checklist.md`:
  - CRITICAL: Factual inaccuracies, PII exposure, offensive content
  - WARNING: Tone mismatch, exceeds length limit, missing citations
  - INFO: Passive voice, repetitive phrasing
