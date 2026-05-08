"""
GitHub REST API tools for the repo visualizer agent.

Uses unauthenticated access by default (60 req/hr per IP) and reads an
optional GITHUB_TOKEN env var for the 5000 req/hr authenticated quota — set
GITHUB_TOKEN in production. No HTML scraping — every call hits the JSON API.
"""

from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import urlparse

import httpx

GITHUB_API = "https://api.github.com"
DEFAULT_TIMEOUT = 15.0
# File path patterns that almost never contribute to a project's mental model.
# Pruned from tree output to keep the LLM context focused on signal.
_NOISE_PATTERNS = (
    "node_modules/",
    ".git/",
    "dist/",
    "build/",
    ".next/",
    "__pycache__/",
    ".venv/",
    "venv/",
    "target/",
    "vendor/",
    "coverage/",
    ".idea/",
    ".vscode/",
    ".DS_Store",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "uv.lock",
    "poetry.lock",
    "Cargo.lock",
)


def _headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "agent-directory-repo-visualizer",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _parse_repo_url(url: str) -> tuple[str, str] | None:
    """
    Accept any of:
      https://github.com/owner/repo
      https://github.com/owner/repo.git
      https://github.com/owner/repo/tree/main/...
      git@github.com:owner/repo.git
      owner/repo

    Returns (owner, repo) or None if unparseable.
    """
    s = url.strip()
    # Bare owner/repo form
    if "/" in s and not s.startswith("http") and "github.com" not in s and "@" not in s:
        parts = s.strip("/").split("/")
        if len(parts) == 2:
            return parts[0], parts[1].removesuffix(".git")
    # SSH form
    m = re.match(r"git@github\.com:([^/]+)/([^/]+?)(?:\.git)?/?$", s)
    if m:
        return m.group(1), m.group(2)
    # HTTPS form
    try:
        u = urlparse(s)
    except Exception:
        return None
    if "github.com" not in (u.netloc or ""):
        return None
    parts = [p for p in u.path.split("/") if p]
    if len(parts) < 2:
        return None
    owner, repo = parts[0], parts[1].removesuffix(".git")
    return owner, repo


def _is_noise(path: str) -> bool:
    return any(pat in path for pat in _NOISE_PATTERNS)


def fetch_repo_meta(url: str) -> dict[str, Any]:
    """Fetch top-level metadata for a public GitHub repository.

    Use this FIRST. It returns the repo name, description, primary language,
    stars, default branch, license, and topics — the orientation an LLM needs
    before it dives into the file tree.

    Args:
        url: A GitHub URL or `owner/repo` shorthand.

    Returns:
        A dict with keys: owner, repo, full_name, description, default_branch,
        language, stars, forks, open_issues, license, topics, homepage, pushed_at.
        On failure, a dict with an `error` key describing what went wrong.
    """
    parsed = _parse_repo_url(url)
    if not parsed:
        return {"error": f"Could not parse a GitHub repo from: {url!r}"}
    owner, repo = parsed
    try:
        r = httpx.get(
            f"{GITHUB_API}/repos/{owner}/{repo}",
            headers=_headers(),
            timeout=DEFAULT_TIMEOUT,
        )
    except httpx.HTTPError as e:
        return {"error": f"Network error fetching repo meta: {e}"}
    if r.status_code == 404:
        return {"error": f"Repository {owner}/{repo} not found (or private)."}
    if r.status_code == 403:
        return {
            "error": "GitHub rate limit hit. Set GITHUB_TOKEN to raise the quota.",
            "rate_limit_remaining": r.headers.get("x-ratelimit-remaining"),
            "rate_limit_reset": r.headers.get("x-ratelimit-reset"),
        }
    if r.status_code != 200:
        return {"error": f"GitHub API returned {r.status_code}: {r.text[:200]}"}
    data = r.json()
    return {
        "owner": owner,
        "repo": repo,
        "full_name": data.get("full_name"),
        "description": data.get("description"),
        "default_branch": data.get("default_branch", "main"),
        "language": data.get("language"),
        "stars": data.get("stargazers_count"),
        "forks": data.get("forks_count"),
        "open_issues": data.get("open_issues_count"),
        "license": (data.get("license") or {}).get("spdx_id"),
        "topics": data.get("topics") or [],
        "homepage": data.get("homepage"),
        "pushed_at": data.get("pushed_at"),
    }


def fetch_repo_tree(url: str, max_entries: int = 400) -> dict[str, Any]:
    """Fetch the recursive file tree for a GitHub repository, with noise pruned.

    Filters out lockfiles, build outputs, vendored deps, and similar noise so
    the LLM sees the signal of the repo's structure. Truncates at `max_entries`
    to stay within prompt budgets.

    Args:
        url: A GitHub URL or `owner/repo` shorthand.
        max_entries: Hard cap on returned paths (default 400).

    Returns:
        A dict with keys: owner, repo, default_branch, total_count,
        truncated (bool), and entries (list of {path, type, size}).
        On failure, a dict with an `error` key.
    """
    parsed = _parse_repo_url(url)
    if not parsed:
        return {"error": f"Could not parse a GitHub repo from: {url!r}"}
    owner, repo = parsed

    # Resolve default branch first (needed for the tree SHA).
    try:
        meta_r = httpx.get(
            f"{GITHUB_API}/repos/{owner}/{repo}",
            headers=_headers(),
            timeout=DEFAULT_TIMEOUT,
        )
    except httpx.HTTPError as e:
        return {"error": f"Network error resolving repo: {e}"}
    if meta_r.status_code != 200:
        return {"error": f"Could not resolve repo: HTTP {meta_r.status_code}"}
    default_branch = meta_r.json().get("default_branch", "main")

    try:
        tree_r = httpx.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}",
            params={"recursive": "1"},
            headers=_headers(),
            timeout=DEFAULT_TIMEOUT,
        )
    except httpx.HTTPError as e:
        return {"error": f"Network error fetching tree: {e}"}
    if tree_r.status_code != 200:
        return {"error": f"Tree fetch failed: HTTP {tree_r.status_code}: {tree_r.text[:200]}"}

    payload = tree_r.json()
    raw_entries = payload.get("tree") or []
    api_truncated = bool(payload.get("truncated"))

    filtered = [e for e in raw_entries if not _is_noise(e.get("path", ""))]
    total_count = len(filtered)
    truncated = api_truncated or total_count > max_entries
    entries = filtered[:max_entries]

    return {
        "owner": owner,
        "repo": repo,
        "default_branch": default_branch,
        "total_count": total_count,
        "truncated": truncated,
        "entries": [
            {"path": e["path"], "type": e["type"], "size": e.get("size")}
            for e in entries
        ],
    }


def fetch_recent_releases(
    url: str,
    limit: int = 5,
    body_max_chars: int = 3000,
) -> dict[str, Any]:
    """Fetch the most recent published releases for a GitHub repository.

    Use this AFTER meta + tree to surface "what's new" — users want to know
    what changed without reading every release page. Returns release notes
    truncated per-release so the LLM can summarize across versions without
    blowing the prompt budget.

    Args:
        url: A GitHub URL or `owner/repo` shorthand.
        limit: Max releases to return (default 5). The API page size is 30,
            so anything above that requires extra calls and is rarely useful.
        body_max_chars: Per-release body truncation (default 3000). Release
            notes can be enormous; we cap each entry rather than the total
            so old releases don't crowd out the latest one.

    Returns:
        A dict with keys: owner, repo, total_seen (int), releases (list).
        Each release: tag_name, name, published_at, is_prerelease, is_draft,
        html_url, body, body_truncated (bool).
        On no releases: `releases` is an empty list (not an error).
        On failure: a dict with an `error` key.
    """
    parsed = _parse_repo_url(url)
    if not parsed:
        return {"error": f"Could not parse a GitHub repo from: {url!r}"}
    owner, repo = parsed

    try:
        r = httpx.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/releases",
            params={"per_page": min(max(limit, 1), 30)},
            headers=_headers(),
            timeout=DEFAULT_TIMEOUT,
        )
    except httpx.HTTPError as e:
        return {"error": f"Network error fetching releases: {e}"}
    if r.status_code == 404:
        # 404 here means the repo itself is missing (releases endpoint always
        # exists for accessible repos, even with zero releases).
        return {"error": f"Repository {owner}/{repo} not found (or private)."}
    if r.status_code == 403:
        return {
            "error": "GitHub rate limit hit. Set GITHUB_TOKEN to raise the quota.",
            "rate_limit_remaining": r.headers.get("x-ratelimit-remaining"),
            "rate_limit_reset": r.headers.get("x-ratelimit-reset"),
        }
    if r.status_code != 200:
        return {"error": f"GitHub API returned {r.status_code}: {r.text[:200]}"}

    payload = r.json() or []
    releases = []
    for rel in payload[:limit]:
        body = rel.get("body") or ""
        body_truncated = len(body) > body_max_chars
        if body_truncated:
            body = body[:body_max_chars]
        releases.append(
            {
                "tag_name": rel.get("tag_name"),
                "name": rel.get("name"),
                "published_at": rel.get("published_at"),
                "is_prerelease": bool(rel.get("prerelease")),
                "is_draft": bool(rel.get("draft")),
                "html_url": rel.get("html_url"),
                "body": body,
                "body_truncated": body_truncated,
            }
        )

    return {
        "owner": owner,
        "repo": repo,
        "total_seen": len(payload),
        "releases": releases,
    }


def read_repo_file(url: str, path: str, max_chars: int = 12000) -> dict[str, Any]:
    """Read the text contents of a single file from a GitHub repository.

    Use this for README, language manifests (package.json, pyproject.toml,
    Cargo.toml, go.mod, etc.), and small entry-point files. Binary files and
    files larger than `max_chars` are truncated.

    Args:
        url: A GitHub URL or `owner/repo` shorthand.
        path: Path within the repo (e.g. "README.md", "src/index.ts").
        max_chars: Hard cap on returned text length (default 12000).

    Returns:
        A dict with keys: owner, repo, path, content, size, truncated (bool).
        On failure, a dict with an `error` key.
    """
    parsed = _parse_repo_url(url)
    if not parsed:
        return {"error": f"Could not parse a GitHub repo from: {url!r}"}
    owner, repo = parsed

    try:
        r = httpx.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
            headers=_headers(),
            timeout=DEFAULT_TIMEOUT,
        )
    except httpx.HTTPError as e:
        return {"error": f"Network error reading file: {e}"}
    if r.status_code == 404:
        return {"error": f"File not found: {path}"}
    if r.status_code != 200:
        return {"error": f"GitHub API returned {r.status_code}: {r.text[:200]}"}

    data = r.json()
    if isinstance(data, list):
        return {"error": f"Path is a directory, not a file: {path}"}

    encoding = data.get("encoding")
    raw = data.get("content") or ""
    if encoding == "base64":
        import base64

        try:
            text = base64.b64decode(raw).decode("utf-8", errors="replace")
        except Exception as e:
            return {"error": f"Could not decode file as utf-8: {e}"}
    else:
        text = raw

    truncated = len(text) > max_chars
    if truncated:
        text = text[:max_chars]

    return {
        "owner": owner,
        "repo": repo,
        "path": path,
        "content": text,
        "size": data.get("size"),
        "truncated": truncated,
    }
