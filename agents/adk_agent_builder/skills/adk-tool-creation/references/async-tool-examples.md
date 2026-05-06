# Async Tool Examples

ADK supports `async` tool functions. Use them when your tool performs I/O (HTTP requests, database queries, file system operations) to avoid blocking the event loop.

## Core Pattern

```python
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


async def my_async_tool(query: str, tool_context: ToolContext) -> dict:
    """Async tool — same signature rules, just add 'async'."""
    try:
        result = await _do_async_work(query)
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "error": str(e)}


my_async_tool_instance = FunctionTool(func=my_async_tool)
```

Registration is identical — `FunctionTool` detects coroutine functions automatically.

## 1. HTTP API Call with `aiohttp`

```python
import aiohttp
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


async def fetch_url(url: str, tool_context: ToolContext) -> dict:
    """Fetch content from a URL.

    Args:
        url: The URL to fetch (must start with https://).

    Returns:
        The response status code and body text (truncated to 5000 chars).
    """
    if not url.startswith("https://"):
        return {"status": "error", "error": "Only HTTPS URLs are allowed"}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                body = await resp.text()
                return {
                    "status": "success",
                    "http_status": resp.status,
                    "body": body[:5000],
                    "truncated": len(body) > 5000,
                }
    except aiohttp.ClientError as e:
        return {"status": "error", "error": f"HTTP error: {e}"}
    except TimeoutError:
        return {"status": "error", "error": "Request timed out after 15s"}


fetch_url_tool = FunctionTool(func=fetch_url)
```

## 2. Database Query with `asyncpg`

```python
import asyncpg
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


async def query_database(
    sql: str,
    limit: int = 100,
    tool_context: ToolContext = None,
) -> dict:
    """Run a read-only SQL query against the application database.

    Args:
        sql: A SELECT query. INSERT/UPDATE/DELETE are blocked.
        limit: Maximum rows to return (1-1000, default 100).

    Returns:
        Query results as a list of row dicts.
    """
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT"):
        return {"status": "error", "error": "Only SELECT queries are allowed"}

    limit = max(1, min(1000, limit))
    sql_with_limit = f"{sql.rstrip(';')} LIMIT {limit}"

    dsn = tool_context.state.get("app:database_url", "")
    if not dsn:
        return {"status": "error", "error": "Database URL not configured in app state"}

    try:
        conn = await asyncpg.connect(dsn)
        try:
            rows = await conn.fetch(sql_with_limit)
            return {
                "status": "success",
                "data": [dict(row) for row in rows],
                "row_count": len(rows),
            }
        finally:
            await conn.close()
    except asyncpg.PostgresError as e:
        return {"status": "error", "error": f"Database error: {e}"}
    except Exception as e:
        return {"status": "error", "error": f"Unexpected error: {e}"}


query_database_tool = FunctionTool(func=query_database)
```

## 3. Parallel Async Operations

```python
import asyncio
import aiohttp
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


async def check_urls(urls: list[str], tool_context: ToolContext) -> dict:
    """Check the health status of multiple URLs concurrently.

    Args:
        urls: List of URLs to check (max 10).

    Returns:
        Status of each URL (up/down and response time in ms).
    """
    if len(urls) > 10:
        return {"status": "error", "error": "Maximum 10 URLs per call"}

    async def _check_one(session: aiohttp.ClientSession, url: str) -> dict:
        import time
        start = time.monotonic()
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                elapsed = (time.monotonic() - start) * 1000
                return {
                    "url": url,
                    "up": resp.status < 500,
                    "status_code": resp.status,
                    "response_ms": round(elapsed, 1),
                }
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            return {"url": url, "up": False, "error": str(e), "response_ms": round(elapsed, 1)}

    try:
        async with aiohttp.ClientSession() as session:
            tasks = [_check_one(session, url) for url in urls]
            results = await asyncio.gather(*tasks)
            return {"status": "success", "data": list(results)}
    except Exception as e:
        return {"status": "error", "error": f"Check failed: {e}"}


check_urls_tool = FunctionTool(func=check_urls)
```

## 4. Streaming / Chunked Processing

```python
import aiohttp
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


async def download_and_summarise(url: str, tool_context: ToolContext) -> dict:
    """Download a large file in chunks and return a size summary.

    Args:
        url: URL of the file to download.

    Returns:
        File size and chunk count.
    """
    try:
        total_bytes = 0
        chunk_count = 0
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                resp.raise_for_status()
                async for chunk in resp.content.iter_chunked(8192):
                    total_bytes += len(chunk)
                    chunk_count += 1
        return {
            "status": "success",
            "total_bytes": total_bytes,
            "chunk_count": chunk_count,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


download_and_summarise_tool = FunctionTool(func=download_and_summarise)
```

## Best Practices

1. **Always set timeouts** — never let an async call hang indefinitely.
2. **Use `async with` for clients/connections** — ensures cleanup on error.
3. **Limit concurrency** — cap `asyncio.gather` calls (e.g., max 10 URLs) to avoid overwhelming external services.
4. **Catch specific exceptions** first, then `Exception` as a fallback.
5. **Close connections in `finally`** blocks when not using context managers.
6. **Avoid `asyncio.run()`** inside tools — ADK already runs an event loop.
