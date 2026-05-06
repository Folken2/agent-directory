---
name: adk-streaming
description: >-
  Building voice and video agents with Gemini Live API — bidirectional
  streaming via WebSocket, LiveRequestQueue, run_live(), RunConfig, and
  audio/video patterns. Load when the user wants a voice agent, live
  agent, or real-time audio/video capabilities.
---

# ADK Streaming — Voice & Video Agents

Build real-time voice and video agents using ADK's bidirectional streaming
with the Gemini Live API.

## When to Use

The user explicitly asks for:
- Voice agent / voice assistant
- Live agent / real-time agent
- Audio/video capabilities
- Conversational agent with speech

## Architecture

```
Browser (mic/cam) → WebSocket /ws/{user_id}/{session_id}
    ↓ upstream_task
LiveRequestQueue (text: send_content, audio: send_realtime)
    ↓
Runner.run_live() ←→ Gemini Live API (BIDI mode)
    ↓ downstream_task
WebSocket → Browser (audio playback + transcriptions)
```

## Key Components

| Component | Purpose |
|-----------|---------|
| `LiveRequestQueue` | Async FIFO buffer between WebSocket and agent. One per session. |
| `Runner.run_live()` | Async generator consuming from queue, yielding events |
| `RunConfig(streaming_mode=StreamingMode.BIDI)` | Configures BIDI mode for Live API |
| `StreamingMode.BIDI` | WebSocket to Gemini Live API (audio/video) |
| `StreamingMode.SSE` | HTTP streaming to standard Gemini API (text only) |

## Template Integration

The generated template includes streaming support gated behind `STREAMING_ENABLED=true`:

1. `streaming.py` — WebSocket handler with upstream/downstream tasks
2. `run_adk.py` — conditional branch that builds Runner manually with `LIVE_MODEL`
3. `static/test_client.html` — minimal browser test client
4. `config/llm.py` — `LIVE_MODEL` config (Gemini model string, not LiteLLM)

## Design Decisions for Streaming Agents

When designing a streaming agent:

1. **Model**: Must use Gemini directly (`LIVE_MODEL`), not OpenRouter/LiteLLM
2. **API Key**: Requires `GOOGLE_API_KEY` (not `OPENROUTER_API_KEY`)
3. **Tools work during streams**: Agent can call FunctionTools mid-conversation
4. **VAD**: Automatic by default — no manual activity signals needed
5. **Transcription**: Enable both input and output transcription for logging
6. **Session resumption**: Enable for connection recovery

## Customization Points

When generating a streaming agent, customize these in `streaming.py`:

- **Voice**: Add `speech_config` to `RunConfig` for voice selection
- **Language**: Set `language_code` in speech config
- **VAD mode**: Disable auto VAD for push-to-talk UIs
- **Video**: Add video modality to `response_modalities`
- **Audio format**: Default is PCM 16kHz input, 24kHz output

Load references for details on each customization.

## References

- Load `streaming-patterns` for RunConfig options, VAD modes, voice selection, and audio format details.
- Load `live-api-reference` for LiveRequestQueue API, event types, and error handling.
