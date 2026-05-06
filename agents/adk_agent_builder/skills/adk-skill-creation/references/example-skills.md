# Example SKILL.md Files

Four complete examples across different domains. Use these as templates when generating new skills.

---

## 1. Security Review Skill

### `skills/security-review/SKILL.md`

```markdown
---
name: security-review
description: >-
  OWASP Top 10 security review checklist for Python web applications —
  injection, broken auth, XSS, CSRF, misconfigurations, and dependency
  vulnerabilities. Load this skill when reviewing code for security issues
  or hardening a web application.
---

# Security Review

## Steps

1. **SQL Injection**: Search for raw SQL string concatenation. Verify all queries use parameterised statements or ORM methods. Load `owasp-checklist` for injection patterns.
2. **Authentication**: Check password hashing (must use bcrypt/argon2, never MD5/SHA1). Verify session tokens have expiry. Check for hardcoded credentials.
3. **XSS**: Ensure all user input rendered in HTML is escaped. Check for unsafe template rendering and unescaped HTML insertion patterns.
4. **CSRF**: Verify state-changing endpoints require CSRF tokens. Check SameSite cookie attribute.
5. **Sensitive Data**: Search for secrets in code (API keys, passwords). Verify HTTPS enforcement. Check error messages don't leak stack traces.
6. **Dependencies**: Run `pip audit` or `safety check`. Flag known CVEs.
7. **Access Control**: Verify authorization checks on every endpoint. Check for IDOR (direct object reference without ownership check).

## Output Format

For each finding, report:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Location**: file path and line number
- **Issue**: what's wrong
- **Fix**: how to fix it

## References

- Load `owasp-checklist` for the complete OWASP Top 10 with code examples.
- Load `dependency-audit` for step-by-step dependency scanning instructions.
```

### `skills/security-review/references/owasp-checklist.md`

Would contain detailed OWASP Top 10 patterns with vulnerable vs. secure code examples.

---

## 2. API Integration Skill

### `skills/api-integration/SKILL.md`

```markdown
---
name: api-integration
description: >-
  Building REST API wrapper tools with retry logic, rate limiting, timeout
  handling, and structured error responses. Load this skill when creating
  tools that call external HTTP APIs.
---

# API Integration

## Steps

1. **Choose HTTP client**: Use `httpx` for sync tools, `aiohttp` for async tools. Never use `urllib` directly.
2. **Set timeouts**: Always configure connect and read timeouts. Default: 10s connect, 30s read.
3. **Handle errors by status code**:
   - 4xx: return error with the API's error message
   - 429: respect Retry-After header, return rate-limit error
   - 5xx: retry up to 3 times with exponential backoff
4. **Structure the response**: Always return `{"status": "success/error", ...}`. Never let raw API responses leak to the LLM.
5. **Validate inputs**: Check required fields before making the API call.
6. **Log but don't expose**: Log full error details, return sanitised messages to the LLM.

## Quick-Start Template

```python
import httpx
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


def call_api(endpoint: str, tool_context: ToolContext) -> dict:
    """Call an external API endpoint.

    Args:
        endpoint: The API endpoint path.

    Returns:
        The API response data.
    """
    base_url = tool_context.state.get("app:api_base_url", "")
    if not base_url:
        return {"status": "error", "error": "API base URL not configured"}
    try:
        resp = httpx.get(f"{base_url}/{endpoint}", timeout=10.0)
        resp.raise_for_status()
        return {"status": "success", "data": resp.json()}
    except httpx.HTTPStatusError as e:
        return {"status": "error", "error": f"API returned {e.response.status_code}"}
    except httpx.TimeoutException:
        return {"status": "error", "error": "API request timed out"}


call_api_tool = FunctionTool(func=call_api)
```

## References

- Load `retry-patterns` for exponential backoff and circuit breaker implementations.
- Load `auth-patterns` for API key, OAuth2, and JWT authentication examples.
```

---

## 3. Data Pipeline Skill

### `skills/data-pipeline/SKILL.md`

```markdown
---
name: data-pipeline
description: >-
  Validates ETL pipeline configurations for data quality — schema checks,
  null handling, deduplication, and idempotency. Load this skill when
  building or reviewing data pipelines.
---

# Data Pipeline Validation

## Steps

1. **Schema validation**: Every pipeline stage must define input and output schemas. Verify column names, types, and nullable constraints.
2. **Null handling**: Check that every nullable column has an explicit handling strategy (drop, fill default, or flag).
3. **Deduplication**: Verify a dedup key is defined. Check for both exact and fuzzy duplicate handling.
4. **Idempotency**: The pipeline must produce the same result if run twice on the same input. Check for upsert logic, not blind inserts.
5. **Error handling**: Verify dead-letter queues or error tables exist for failed records.
6. **Monitoring**: Check for row count assertions, data freshness checks, and alerting.

## Quality Checks Template

```python
def validate_stage(df, schema: dict) -> list[str]:
    """Validate a DataFrame against a schema. Returns list of errors."""
    errors = []
    for col, expected_type in schema.items():
        if col not in df.columns:
            errors.append(f"Missing column: {col}")
        elif str(df[col].dtype) != expected_type:
            errors.append(f"Column {col}: expected {expected_type}, got {df[col].dtype}")
    return errors
```

## References

- Load `schema-patterns` for schema definition and validation patterns.
- Load `idempotency-guide` for upsert and dedup implementation examples.
```

---

## 4. Customer Support Skill

### `skills/customer-support/SKILL.md`

```markdown
---
name: customer-support
description: >-
  Handles customer support conversations with tone guidelines, escalation
  rules, refund policies, and common issue resolution flows. Load this
  skill when the agent needs to handle customer-facing support interactions.
---

# Customer Support

## Tone Guidelines

- Be empathetic and professional. Acknowledge the customer's frustration before problem-solving.
- Use the customer's name when available.
- Avoid jargon — explain technical terms in simple language.
- Never blame the customer or other teams.

## Resolution Flow

1. **Identify the issue**: Ask clarifying questions if the problem is ambiguous. Categorise as: billing, technical, account, or general inquiry.
2. **Check known issues**: Load `known-issues` to see if this matches an active incident.
3. **Attempt resolution**:
   - Billing: can process refunds under $50 automatically. Over $50 requires manager approval — escalate.
   - Technical: walk through troubleshooting steps. If unresolved after 3 attempts, escalate to engineering.
   - Account: can reset passwords, update email. Cannot delete accounts — escalate.
4. **Escalation**: When escalating, provide a summary with: issue category, steps already taken, customer sentiment.

## Escalation Rules

| Condition | Action |
|-----------|--------|
| Refund > $50 | Escalate to billing manager |
| Legal threat | Escalate to legal team immediately |
| Technical issue unresolved after 3 attempts | Escalate to engineering |
| Customer requests supervisor | Escalate to team lead |
| Account deletion | Escalate to compliance |

## References

- Load `known-issues` for currently active incidents and workarounds.
- Load `refund-policy` for detailed refund eligibility rules.
- Load `escalation-contacts` for team contact information.
```

---

## Patterns Across All Examples

1. Every skill has a clear **trigger condition** in the description ("Load this skill when...").
2. Instructions use **numbered steps** for the main workflow.
3. Instructions include at least a **minimal template or example**.
4. A **References section** at the end lists all L3 resources with what they contain.
5. Each skill is **self-contained** — it has everything needed to complete the task.
