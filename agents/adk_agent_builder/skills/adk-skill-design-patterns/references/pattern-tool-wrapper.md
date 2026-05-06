# Tool Wrapper Pattern

## When to Use

Use Tool Wrapper when the agent calls external APIs, libraries, or services that have:
- Complex authentication or setup requirements
- Rate limits, retry logic, or pagination
- Common pitfalls that developers hit repeatedly
- Best practices that aren't obvious from the API docs

The skill acts as an **expert guide** — it doesn't replace the tool, it teaches the agent how to use the tool well.

## Architecture

```
User Request
    ↓
Agent decides to call external API
    ↓
Agent loads Tool Wrapper skill (L2: best practices overview)
    ↓
Agent loads specific reference (L3: API patterns, error codes, examples)
    ↓
Agent calls the tool following the skill's guidance
    ↓
Response (correctly handled: retries, error mapping, pagination)
```

## Key Principles

1. **Encode tribal knowledge** — the stuff that's in blog posts and Stack Overflow, not in official docs.
2. **Store API docs in references/** — don't make the agent guess API shapes.
3. **Include error handling patterns** — map API error codes to actionable recovery steps.
4. **Document rate limits and quotas** — teach the agent to batch or throttle.
5. **Provide complete request/response examples** — not pseudocode.

## Skeleton Template

### SKILL.md

```markdown
---
name: {{service}}-best-practices
description: >-
  Best practices for using the {{Service}} API — authentication, error handling,
  rate limits, and common patterns. Load when creating or modifying tools that
  call {{Service}}.
---

# {{Service}} Best Practices

## Authentication
- Always use {{auth_method}} via environment variable `{{ENV_VAR}}`.
- Never hardcode credentials. Check for missing keys and return clear errors.

## Common Patterns

### Creating Resources
1. Validate input before calling the API.
2. Use idempotency keys for create operations to prevent duplicates.
3. Handle rate limit responses (HTTP 429) with exponential backoff.

### Reading Resources
1. Use pagination for list endpoints — never assume all results fit in one page.
2. Cache frequently-accessed resources using session state.

### Error Handling
| Status Code | Meaning | Recovery |
|-------------|---------|----------|
| 400 | Bad request | Check input validation, return user-friendly error |
| 401 | Auth failed | Check API key is set and valid |
| 404 | Not found | Confirm resource ID, suggest alternatives |
| 429 | Rate limited | Wait and retry with exponential backoff |
| 500 | Server error | Retry up to 3 times, then report failure |

## Anti-Patterns
- Do NOT create resources without idempotency keys.
- Do NOT swallow errors — always surface them to the user.
- Do NOT hardcode API versions — use the version from config.

## References

- Load `api-patterns` for complete request/response examples.
- Load `error-codes` for the full error code reference table.
```

### references/api-patterns.md

```markdown
# {{Service}} API Patterns

## Create a Resource

\```python
def create_{{resource}}(name: str, tool_context: ToolContext) -> dict:
    """Create a new {{resource}}.

    Args:
        name: The {{resource}} name.

    Returns:
        Dict with status and created resource data.
    """
    try:
        client = _get_client()  # uses env var
        result = client.{{resources}}.create(
            name=name,
            idempotency_key=f"create-{name}-{uuid4().hex[:8]}",
        )
        return {"status": "success", "data": result.to_dict()}
    except RateLimitError:
        return {"status": "error", "error": "Rate limited. Please wait and retry."}
    except AuthenticationError:
        return {"status": "error", "error": "API key invalid. Check {{ENV_VAR}}."}
    except Exception as e:
        return {"status": "error", "error": str(e)}
\```

## List Resources (with pagination)

\```python
def list_{{resources}}(page: int = 1, tool_context: ToolContext) -> dict:
    """List {{resources}} with pagination.

    Args:
        page: Page number (default 1).

    Returns:
        Dict with status, data list, and pagination info.
    """
    try:
        client = _get_client()
        result = client.{{resources}}.list(limit=20, offset=(page - 1) * 20)
        return {
            "status": "success",
            "data": [r.to_dict() for r in result.data],
            "has_more": result.has_more,
            "page": page,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
\```
```

## Real-World Example

A Stripe agent would have:
- `stripe-best-practices/SKILL.md` — auth via `STRIPE_SECRET_KEY`, idempotency keys, webhook verification
- `stripe-best-practices/references/api-patterns.md` — complete examples for charges, customers, subscriptions
- `stripe-best-practices/references/error-codes.md` — Stripe error code → recovery action mapping
- `stripe-best-practices/references/webhooks.md` — webhook signature verification patterns
