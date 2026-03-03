# API Endpoints Fix Required

## Issues Found

### 1. List Agents Endpoint
**Current Implementation:**
- Trying: `/agents`, `/api/agents`, `/v1/agents`
- Returns: Array of agent objects

**Should Be (from adk_web_server.py line 701):**
- Endpoint: `/list-apps`
- Returns: `list[str]` (just agent names)

### 2. Run Agent Endpoint
**Current Implementation:**
- Trying: `/agents/${agent}/run`, `/api/agents/${agent}/run`, `/v1/agents/${agent}/run`, `/run`
- Request format: `{ agent, message }`

**Should Be (from adk_web_server.py line 1374):**
- Endpoint: `/run` (POST)
- Request format: `RunAgentRequest`:
  ```python
  {
    "app_name": str,           # Agent name
    "user_id": str,            # User identifier
    "session_id": str,         # Session identifier
    "new_message": Content,    # Google GenAI Content type (can be string or structured)
    "streaming": bool,         # False for non-streaming
    "state_delta": Optional[dict[str, Any]],
    "invocation_id": Optional[str]
  }
  ```
- Response: `list[Event]` (array of Event objects)

### 3. Streaming Endpoint
**Current Implementation:**
- Trying: `/agents/${agent}/stream`, `/api/agents/${agent}/stream`, `/v1/agents/${agent}/stream`, `/stream`

**Should Be (from adk_web_server.py line 1395):**
- Endpoint: `/run_sse` (POST)
- Request format: Same `RunAgentRequest` but with `streaming: true`
- Response: Server-Sent Events (SSE) stream
- Content-Type: `text/event-stream`
- Format: `data: {json_event}\n\n`

### 4. Session Management
**Missing Implementation:**
- Need to create/get sessions before running agents
- Endpoint: `/apps/{app_name}/users/{user_id}/sessions` (POST to create, GET to list)
- Endpoint: `/apps/{app_name}/users/{user_id}/sessions/{session_id}` (GET to get specific session)

### 5. Artifacts Endpoint
**Current Implementation:**
- Trying: `/runs/${runId}/artifacts`, `/api/runs/${runId}/artifacts`, etc.

**Should Be (from adk_web_server.py line 1258):**
- Endpoint: `/apps/{app_name}/users/{user_id}/sessions/{session_id}/artifacts/{artifact_name}` (GET)
- Endpoint: `/apps/{app_name}/users/{user_id}/sessions/{session_id}/artifacts` (GET to list)

### 6. Static Export Configuration
**Current:**
- `next.config.ts` doesn't have `output: 'export'`
- Build creates `.next/` directory (server-side)

**Should Be:**
- Add `output: 'export'` to `next.config.ts`
- Build creates `out/` directory (static files)
- `web_assets_dir` should point to `adk-web-ui/out/`

## Required Changes

1. **Update `lib/adk-client.ts`:**
   - Change `listAgents()` to use `/list-apps`
   - Change `runAgent()` to use `/run` with proper `RunAgentRequest` format
   - Change `streamAgent()` to use `/run_sse` with SSE parsing
   - Add session management methods
   - Update artifact methods to use correct endpoints

2. **Update `next.config.ts`:**
   - Add `output: 'export'` for static export

3. **Update components:**
   - Handle session creation/management
   - Update to work with Event objects from `/run` endpoint
   - Parse SSE events from `/run_sse` endpoint

4. **Update README.md:**
   - Document that `web_assets_dir` should point to `adk-web-ui/out/`
   - Document session management requirements

