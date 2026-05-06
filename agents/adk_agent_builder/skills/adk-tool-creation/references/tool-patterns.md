# Tool Patterns — Complete Implementations

## 1. Simple CRUD Tool

```python
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext
from typing import Any


# ---------- CREATE ----------
def create_item(name: str, description: str, tool_context: ToolContext) -> dict:
    """Create a new item in the inventory.

    Args:
        name: Display name for the item (1-100 characters).
        description: Detailed description of the item.

    Returns:
        The created item with its assigned ID.
    """
    try:
        items: dict = tool_context.state.get("items", {})
        item_id = str(len(items) + 1)
        item = {"id": item_id, "name": name, "description": description}
        items[item_id] = item
        tool_context.state["items"] = items
        return {"status": "success", "message": f"Created item {item_id}", "data": item}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ---------- READ ----------
def get_item(item_id: str, tool_context: ToolContext) -> dict:
    """Retrieve an item by its ID.

    Args:
        item_id: The unique identifier of the item.

    Returns:
        The item data if found, or an error message.
    """
    items: dict = tool_context.state.get("items", {})
    item = items.get(item_id)
    if item is None:
        return {"status": "error", "error": f"Item {item_id} not found"}
    return {"status": "success", "data": item}


# ---------- UPDATE ----------
def update_item(
    item_id: str,
    name: str = "",
    description: str = "",
    tool_context: ToolContext = None,
) -> dict:
    """Update an existing item's name and/or description.

    Args:
        item_id: The unique identifier of the item to update.
        name: New name (leave empty to keep current).
        description: New description (leave empty to keep current).

    Returns:
        The updated item data.
    """
    try:
        items: dict = tool_context.state.get("items", {})
        item = items.get(item_id)
        if item is None:
            return {"status": "error", "error": f"Item {item_id} not found"}
        if name:
            item["name"] = name
        if description:
            item["description"] = description
        items[item_id] = item
        tool_context.state["items"] = items
        return {"status": "success", "message": f"Updated item {item_id}", "data": item}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ---------- DELETE ----------
def delete_item(item_id: str, tool_context: ToolContext) -> dict:
    """Delete an item from the inventory.

    Args:
        item_id: The unique identifier of the item to delete.

    Returns:
        Confirmation of deletion.
    """
    try:
        items: dict = tool_context.state.get("items", {})
        if item_id not in items:
            return {"status": "error", "error": f"Item {item_id} not found"}
        deleted = items.pop(item_id)
        tool_context.state["items"] = items
        return {"status": "success", "message": f"Deleted item {item_id}", "data": deleted}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ---------- LIST ----------
def list_items(tool_context: ToolContext) -> dict:
    """List all items in the inventory.

    Returns:
        A list of all items.
    """
    items: dict = tool_context.state.get("items", {})
    return {"status": "success", "data": list(items.values()), "count": len(items)}


# Wrap each function
create_item_tool = FunctionTool(func=create_item)
get_item_tool = FunctionTool(func=get_item)
update_item_tool = FunctionTool(func=update_item)
delete_item_tool = FunctionTool(func=delete_item)
list_items_tool = FunctionTool(func=list_items)
```

## 2. API Wrapper Tool

```python
import httpx
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


def search_github_repos(
    query: str,
    language: str = "",
    max_results: int = 5,
    tool_context: ToolContext = None,
) -> dict:
    """Search GitHub repositories by keyword and optional language filter.

    Args:
        query: Search keywords (e.g., "machine learning framework").
        language: Filter by programming language (e.g., "python", "rust").
        max_results: Maximum number of results to return (1-30, default 5).

    Returns:
        A list of matching repositories with name, URL, stars, and description.
    """
    try:
        max_results = max(1, min(30, max_results))
        params = {"q": query, "per_page": max_results, "sort": "stars"}
        if language:
            params["q"] += f" language:{language}"

        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                "https://api.github.com/search/repositories",
                params=params,
                headers={"Accept": "application/vnd.github.v3+json"},
            )
            response.raise_for_status()

        data = response.json()
        repos = [
            {
                "name": repo["full_name"],
                "url": repo["html_url"],
                "stars": repo["stargazers_count"],
                "description": repo.get("description", ""),
            }
            for repo in data.get("items", [])
        ]
        return {"status": "success", "data": repos, "total_count": data["total_count"]}

    except httpx.TimeoutException:
        return {"status": "error", "error": "GitHub API request timed out after 10s"}
    except httpx.HTTPStatusError as e:
        return {"status": "error", "error": f"GitHub API returned {e.response.status_code}"}
    except Exception as e:
        return {"status": "error", "error": f"Unexpected error: {e}"}


search_github_repos_tool = FunctionTool(func=search_github_repos)
```

## 3. File Operation Tool

```python
import pathlib
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


ALLOWED_BASE = pathlib.Path("/tmp/workspace")


def _safe_path(relative_path: str) -> pathlib.Path | None:
    """Resolve and validate that path stays within ALLOWED_BASE."""
    target = (ALLOWED_BASE / relative_path).resolve()
    if not str(target).startswith(str(ALLOWED_BASE.resolve())):
        return None
    return target


def read_file(file_path: str, tool_context: ToolContext) -> dict:
    """Read the contents of a file from the workspace.

    Args:
        file_path: Relative path within the workspace (e.g., "data/config.json").

    Returns:
        The file contents as a string, or an error if the file is not found
        or is outside the allowed workspace.
    """
    target = _safe_path(file_path)
    if target is None:
        return {"status": "error", "error": "Path traversal not allowed"}
    if not target.exists():
        return {"status": "error", "error": f"File not found: {file_path}"}
    try:
        content = target.read_text(encoding="utf-8")
        return {"status": "success", "data": content, "size_bytes": len(content.encode())}
    except Exception as e:
        return {"status": "error", "error": f"Read failed: {e}"}


def write_file(file_path: str, content: str, tool_context: ToolContext) -> dict:
    """Write content to a file in the workspace. Creates parent directories as needed.

    Args:
        file_path: Relative path within the workspace (e.g., "output/report.txt").
        content: The text content to write.

    Returns:
        Confirmation with the file path and size.
    """
    target = _safe_path(file_path)
    if target is None:
        return {"status": "error", "error": "Path traversal not allowed"}
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {
            "status": "success",
            "message": f"Wrote {file_path}",
            "size_bytes": len(content.encode()),
        }
    except Exception as e:
        return {"status": "error", "error": f"Write failed: {e}"}


read_file_tool = FunctionTool(func=read_file)
write_file_tool = FunctionTool(func=write_file)
```

## 4. Search / Query Tool with Pagination

```python
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext


def search_knowledge_base(
    query: str,
    page: int = 1,
    page_size: int = 10,
    tool_context: ToolContext = None,
) -> dict:
    """Search the knowledge base for articles matching a query.

    Args:
        query: Natural-language search query.
        page: Page number (1-indexed, default 1).
        page_size: Results per page (1-50, default 10).

    Returns:
        Matching articles with title, snippet, and relevance score,
        plus pagination metadata.
    """
    try:
        page = max(1, page)
        page_size = max(1, min(50, page_size))

        # Example: replace with real search backend
        all_results = _perform_search(query)  # returns list of dicts
        total = len(all_results)
        start = (page - 1) * page_size
        end = start + page_size
        page_results = all_results[start:end]

        return {
            "status": "success",
            "data": page_results,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_results": total,
                "total_pages": (total + page_size - 1) // page_size,
                "has_next": end < total,
            },
        }
    except Exception as e:
        return {"status": "error", "error": f"Search failed: {e}"}


def _perform_search(query: str) -> list[dict]:
    """Stub — replace with your actual search implementation."""
    return [
        {"title": f"Result {i}", "snippet": f"Matched '{query}'...", "score": 0.9 - i * 0.05}
        for i in range(25)
    ]


search_knowledge_base_tool = FunctionTool(func=search_knowledge_base)
```

## Key Takeaways

| Pattern | Error handling | State usage | Notes |
|---------|---------------|-------------|-------|
| CRUD | try/except per operation | `tool_context.state` for storage | Validate existence before update/delete |
| API wrapper | Catch timeout + HTTP errors separately | Optional caching in state | Always set a timeout |
| File ops | Path traversal guard + try/except | Minimal | Resolve + check base prefix |
| Search | Catch backend errors | Optional query caching | Clamp pagination params |
