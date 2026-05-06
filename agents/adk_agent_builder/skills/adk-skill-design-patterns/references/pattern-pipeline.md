# Pipeline Pattern

## When to Use

Use Pipeline when the agent runs **multi-step, sensitive workflows** where:
- Steps must execute in a strict order
- Each step must pass validation before the next begins
- Failure at any step must halt the pipeline (not silently continue)
- The workflow involves irreversible or expensive operations
- An audit trail of each step is required

Examples: deployment pipelines, data migrations, financial operations, approval chains, content publishing workflows.

## Architecture

```
User Request ("deploy to production")
    ↓
Agent loads Pipeline skill (L2: step definitions + gate criteria)
    ↓
┌─────────────────────────────────────────────┐
│  Step 1: Pre-checks                         │
│  → Validate prerequisites                   │
│  → GATE: All pre-checks pass?               │
│     YES → continue    NO → halt + report     │
├─────────────────────────────────────────────┤
│  Step 2: Prepare                            │
│  → Build/stage the changes                  │
│  → GATE: Preparation successful?            │
│     YES → continue    NO → rollback + halt   │
├─────────────────────────────────────────────┤
│  Step 3: Execute                            │
│  → Apply the changes                        │
│  → GATE: Execution successful?              │
│     YES → continue    NO → rollback + halt   │
├─────────────────────────────────────────────┤
│  Step 4: Verify                             │
│  → Confirm changes are live and correct     │
│  → GATE: Verification passed?              │
│     YES → complete    NO → rollback + alert  │
└─────────────────────────────────────────────┘
    ↓
Pipeline Complete (with full step-by-step audit log)
```

## Key Principles

1. **Explicit steps** — every step is named, numbered, and has clear entry/exit criteria.
2. **Gate checkpoints** — between every step, validate before proceeding.
3. **Halt on failure** — never skip a failing gate. Report the failure clearly.
4. **Rollback strategy** — define what happens when a step fails (undo, alert, retry).
5. **Audit trail** — log each step's result for traceability.
6. **Human-in-the-loop gates** — for high-stakes steps, require explicit user approval.

## Skeleton Template

### SKILL.md

```markdown
---
name: {{workflow}}-pipeline
description: >-
  Enforces the {{workflow}} pipeline: {{step_names}}. Each step has a
  validation gate. Load when executing {{workflow}} to ensure correct
  order and safety checks.
---

# {{Workflow}} Pipeline

## Overview
This pipeline enforces a strict {{N}}-step workflow for {{workflow}}.
Every step must pass its gate before the next begins.

## Pipeline Steps

### Step 1: {{Step Name}}
**Purpose:** {{What this step does}}
**Actions:**
1. {{Action 1}}
2. {{Action 2}}

**Gate Criteria:**
- [ ] {{Criterion 1}}
- [ ] {{Criterion 2}}

**On Failure:** {{What to do — halt, retry, rollback, alert user}}

---

### Step 2: {{Step Name}}
**Purpose:** {{What this step does}}
**Actions:**
1. {{Action 1}}
2. {{Action 2}}

**Gate Criteria:**
- [ ] {{Criterion 1}}
- [ ] {{Criterion 2}}

**On Failure:** {{rollback Step 1 + halt}}

---

### Step 3: {{Step Name}}
...

### Step N: {{Final Step — usually Verify}}
**Purpose:** Confirm the workflow completed successfully.
**Actions:**
1. {{Verification action 1}}
2. {{Verification action 2}}

**Gate Criteria:**
- [ ] {{Final criterion}}

**On Failure:** {{Rollback all steps + alert user}}

## Human-in-the-Loop Gates

These steps require **explicit user approval** before proceeding:
- Step {{X}}: "About to {{irreversible_action}}. Proceed? (yes/no)"

Use ADK's `before_tool_callback` to implement approval gates:
\```python
async def approval_gate(callback_context, tool):
    if tool.name == "{{dangerous_tool}}":
        # Set state to request approval
        callback_context.state["pending_approval"] = True
        return {"status": "waiting", "message": "Awaiting user approval..."}
\```

## Progress Reporting

After each step, report progress:
> "✓ Step 1/{{N}} complete: {{step_name}}. Proceeding to Step 2: {{next_step_name}}."

On failure:
> "✗ Step {{X}}/{{N}} failed: {{step_name}}. Reason: {{reason}}. Pipeline halted."

## Rollback Strategy

| Failed At | Rollback Actions |
|-----------|-----------------|
| Step 1 | No rollback needed (pre-checks only) |
| Step 2 | {{Undo preparation}} |
| Step 3 | {{Undo execution + preparation}} |
| Step N | {{Full rollback}} |

## References

- Load `step-details` for detailed validation criteria and examples for each step.
```

### references/step-details.md (optional)

```markdown
# {{Workflow}} Step Details

## Step 1: {{Step Name}}

### Validation Criteria (Detail)

**{{Criterion 1}}:**
- What to check: {{specific check}}
- How to check: {{command, API call, or tool to use}}
- Pass condition: {{what "pass" looks like}}
- Fail example: {{what failure looks like}}

**{{Criterion 2}}:**
...

### Common Failures
| Failure | Cause | Resolution |
|---------|-------|------------|
| {{failure_1}} | {{cause}} | {{fix}} |
| {{failure_2}} | {{cause}} | {{fix}} |

---

## Step 2: {{Step Name}}
...
```

## Real-World Example

A deployment agent would have:
- `deploy-pipeline/SKILL.md`:
  - Step 1: Pre-checks (branch is clean, tests pass, no open blockers)
  - Step 2: Build (compile, run integration tests, create artifact)
  - Step 3: Stage (deploy to staging, run smoke tests) — **HITL gate: "Staging looks good?"**
  - Step 4: Deploy (push to production, run health checks)
  - Step 5: Verify (check monitoring dashboards, confirm no error spike)
- `deploy-pipeline/references/step-details.md`:
  - Pre-check details: exact git commands, test commands, blocker query
  - Rollback details: exact commands to revert each step

A data migration agent would have:
- `migration-pipeline/SKILL.md`:
  - Step 1: Validate schema compatibility
  - Step 2: Backup existing data — **HITL gate: "Backup complete. Proceed with migration?"**
  - Step 3: Run migration script
  - Step 4: Verify row counts and data integrity
  - Rollback: Restore from backup at any failure point
