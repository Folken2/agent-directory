# Live API Reference

## LiveRequestQueue

Thread-safe async queue for sending messages to the agent during streaming.

```python
from google.adk.agents.live_request_queue import LiveRequestQueue

queue = LiveRequestQueue()
```

### Methods

| Method | Purpose | When to Use |
|--------|---------|-------------|
| `send_content(content)` | Send text message | User types text |
| `send_realtime(blob)` | Send audio/video blob | Streaming mic/cam data |
| `send_activity_start()` | Signal speech started | Only with manual VAD |
| `send_activity_end()` | Signal speech ended | Only with manual VAD |
| `close()` | Close the queue | Session termination (always call in finally) |

### send_content

```python
from google.genai import types

content = types.Content(parts=[types.Part(text="Hello")])
queue.send_content(content)
```

### send_realtime

```python
audio_blob = types.Blob(
    mime_type="audio/pcm;rate=16000",
    data=audio_bytes,  # raw PCM bytes
)
queue.send_realtime(audio_blob)
```

## Runner.run_live

Async generator that processes the queue and yields events.

```python
async for event in runner.run_live(
    user_id=user_id,
    session_id=session_id,
    live_request_queue=queue,
    run_config=run_config,
):
    # event is an ADK Event object
    json_str = event.model_dump_json(exclude_none=True, by_alias=True)
```

## Event Types

Events from `run_live()` contain various fields:

| Field | Content |
|-------|---------|
| `event.content` | Agent's response (text parts, audio inline_data) |
| `event.server_content.model_turn.parts` | Model output during streaming |
| `event.tool_calls` | Tool invocations during the session |
| `event.actions` | State changes, session updates |

### Checking for Audio

```python
if event.content and event.content.parts:
    for part in event.content.parts:
        if part.inline_data and part.inline_data.mime_type.startswith("audio/"):
            # Audio data in part.inline_data.data (base64)
            pass
        if part.text:
            # Text transcription
            pass
```

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `WebSocketDisconnect` | Client closed connection | Close queue, clean up |
| `ConnectionError` | Network issue | Retry with session resumption |
| `InvalidArgument` | Bad RunConfig | Check model supports Live API |
| Queue closed | Session ended | Create new queue for new session |

## Important Notes

1. **One queue per session** — create a new `LiveRequestQueue` for each WebSocket connection
2. **Always close the queue** — use `finally` block to call `queue.close()`
3. **Gemini models only** — BIDI mode requires Gemini models (e.g., `gemini-2.0-flash-live-001`)
4. **Concurrent tasks** — always run upstream and downstream with `asyncio.gather()`
