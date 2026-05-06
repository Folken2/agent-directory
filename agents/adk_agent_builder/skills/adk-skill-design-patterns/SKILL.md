---
name: adk-skill-design-patterns
description: >-
  Five canonical skill design patterns for ADK agents: Tool Wrapper, Generator,
  Reviewer, Inversion, and Pipeline. Load this skill during Step 2 (Design) to
  recommend which patterns fit the user's agent, and during Step 4 (Generate) to
  get skeleton templates for each pattern.
---

# Skill Design Patterns

Every skill you create for a generated agent should follow one (or more) of these 5 canonical patterns. Each pattern solves a specific class of problem. Use the decision matrix below to match the user's agent to the right patterns.

## The 5 Patterns

### 1. Tool Wrapper
Encodes best practices for using a library, API, or service into a skill. The skill loads domain docs from `references/` and guides the agent to use tools correctly — retry logic, rate limits, auth patterns, error handling.

**Use when:** The agent calls external APIs or uses complex libraries.

### 2. Generator
Produces structured documents or artifacts from reusable templates. The skill contains fill-in-the-blank templates and formatting rules. The agent fills in details based on user input.

**Use when:** The agent produces reports, emails, configs, code scaffolds, or any structured output.

### 3. Reviewer
Scores or validates output against a checklist stored in a reference file. The agent checks its own work (or external input) before responding. Returns structured feedback with severity levels.

**Use when:** Output quality matters — code review, content moderation, compliance checks, data validation, or self-assessment before responding.

### 4. Inversion
The agent interviews the user before acting. Instead of guessing, it asks targeted clarifying questions to reduce ambiguity. The skill defines what questions to ask and when to stop asking.

**Use when:** The agent handles ambiguous, open-ended, or high-stakes requests where guessing wrong is costly.

### 5. Pipeline
Enforces a strict multi-step workflow with gate checkpoints. Each step must pass before the next begins. The skill defines the steps, their order, validation criteria at each gate, and what happens on failure.

**Use when:** The agent runs sensitive, multi-step workflows — deployments, financial operations, data migrations, approval chains.

---

## Decision Matrix

Use this table to match the user's agent to patterns. **Multiple patterns can combine.**

| Agent Characteristic | Recommended Pattern | Example |
|---------------------|-------------------|---------|
| Calls external APIs or services | **Tool Wrapper** | Stripe agent → `stripe-best-practices` skill |
| Produces structured documents | **Generator** | Report agent → `report-template` skill |
| Output quality is critical | **Reviewer** | SQL agent → `query-review` skill checks for injection |
| Handles ambiguous requests | **Inversion** | Project planner → `requirements-interview` skill |
| Runs multi-step sensitive workflows | **Pipeline** | Deploy agent → `deploy-pipeline` skill with gates |
| Calls APIs + quality matters | **Tool Wrapper + Reviewer** | API agent with response validation |
| Ambiguous input + structured output | **Inversion + Generator** | Email drafter that interviews first |
| Sensitive multi-step + quality gates | **Pipeline + Reviewer** | Data migration with validation at each step |

## How to Apply During Design (Step 2)

1. Review what you learned in Step 1 (Discovery) about the agent's goals, tasks, and tools.
2. Walk through the decision matrix above. For each row that matches, note the pattern.
3. Propose skills to the user, naming which pattern each follows:
   > "I recommend a `stripe-best-practices` skill (Tool Wrapper pattern) to encode API best practices, and a `response-validator` skill (Reviewer pattern) to check responses before returning them."
4. For each recommended pattern, load its reference file for the skeleton template:
   - `load_skill_resource("adk-skill-design-patterns", "pattern-tool-wrapper.md")`
   - `load_skill_resource("adk-skill-design-patterns", "pattern-generator.md")`
   - `load_skill_resource("adk-skill-design-patterns", "pattern-reviewer.md")`
   - `load_skill_resource("adk-skill-design-patterns", "pattern-inversion.md")`
   - `load_skill_resource("adk-skill-design-patterns", "pattern-pipeline.md")`

## How to Apply During Generation (Step 4)

1. Load the reference for each pattern you're implementing.
2. Use the skeleton template as a starting point.
3. Customize the skeleton with domain-specific content from the user's requirements.
4. Follow `adk-skill-creation` for SKILL.md formatting rules.

## Combining Patterns

Most real agents benefit from 2-3 patterns. Common combinations:

- **Inversion + Generator**: Interview first, then produce structured output.
- **Tool Wrapper + Reviewer**: Use APIs correctly, then validate the result.
- **Pipeline + Reviewer**: Multi-step workflow with quality gates at each step.
- **Inversion + Pipeline**: Clarify requirements, then enforce strict execution.

When combining, create **one skill per pattern** — don't merge patterns into a single skill. Keep separation of concerns clean.

## References

- Load `pattern-tool-wrapper` for the Tool Wrapper pattern guide and skeleton template.
- Load `pattern-generator` for the Generator pattern guide and skeleton template.
- Load `pattern-reviewer` for the Reviewer pattern guide and skeleton template.
- Load `pattern-inversion` for the Inversion pattern guide and skeleton template.
- Load `pattern-pipeline` for the Pipeline pattern guide and skeleton template.
