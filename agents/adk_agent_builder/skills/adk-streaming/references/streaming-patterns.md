# Streaming Patterns

## RunConfig Options

### Basic Audio (default)

```python
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.genai import types

run_config = RunConfig(
    streaming_mode=StreamingMode.BIDI,
    response_modalities=["AUDIO"],
    input_audio_transcription=types.AudioTranscriptionConfig(),
    output_audio_transcription=types.AudioTranscriptionConfig(),
    session_resumption=types.SessionResumptionConfig(),
)
```

### Custom Voice

```python
from google.genai import types

run_config = RunConfig(
    streaming_mode=StreamingMode.BIDI,
    response_modalities=["AUDIO"],
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name="Aoede"  # Options: Aoede, Charon, Fenrir, Kore, Puck
            )
        ),
        language_code="en-US",
    ),
    input_audio_transcription=types.AudioTranscriptionConfig(),
    output_audio_transcription=types.AudioTranscriptionConfig(),
)
```

### Text-Only Streaming (SSE)

For text streaming without voice, use SSE mode (works with any model):

```python
run_config = RunConfig(
    streaming_mode=StreamingMode.SSE,
    response_modalities=["TEXT"],
)
```

## VAD Modes

### Automatic VAD (default — recommended)

VAD is enabled by default. The Live API detects speech boundaries automatically.
No `send_activity_start()` or `send_activity_end()` needed.

```python
# Just stream audio continuously
while audio_available:
    audio_chunk = get_audio_chunk()
    live_request_queue.send_realtime(audio_chunk)
```

### Manual VAD (push-to-talk)

Disable automatic VAD for push-to-talk UIs:

```python
run_config = RunConfig(
    streaming_mode=StreamingMode.BIDI,
    response_modalities=["AUDIO"],
    realtime_input_config=types.RealtimeInputConfig(
        automatic_activity_detection=types.AutomaticActivityDetection(
            disabled=True
        )
    ),
)

# Client must send activity signals
live_request_queue.send_activity_start()
# ... stream audio ...
live_request_queue.send_activity_end()
```

## Audio Formats

| Direction | Format | Sample Rate | Bit Depth | Channels |
|-----------|--------|-------------|-----------|----------|
| Input (mic → server) | PCM signed LE | 16,000 Hz | 16-bit | Mono |
| Output (server → speaker) | PCM signed LE | 24,000 Hz | 16-bit | Mono |

MIME types:
- Input: `audio/pcm;rate=16000`
- Output: `audio/pcm;rate=24000`

## Tool Calling During Streams

Tools work during live sessions. The agent can call FunctionTools mid-conversation
and the results are streamed back. No special configuration needed — tools defined
in the agent work automatically.

## Session Resumption

Enable session resumption to handle connection drops gracefully:

```python
run_config = RunConfig(
    streaming_mode=StreamingMode.BIDI,
    session_resumption=types.SessionResumptionConfig(),
)
```

The client receives a session resumption token in events. On reconnect, send it
back to resume from where the conversation left off.
