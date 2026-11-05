/**
 * Wraps the ADK SSE body so a stalled or runaway agent can't hold a
 * connection (and keep spending) forever, and so the route learns how the
 * stream ended, which is the only correct moment to record run completion.
 */
import { FRIENDLY_MESSAGES, runErrorCode, type ApiErrorCode } from './api-error.ts';

export type StreamOutcome =
  | 'completed'
  | 'idle_timeout'
  | 'max_duration'
  | 'client_cancelled'
  | 'upstream_error'
  // The stream carried a failure event. Wins over how the stream then ended:
  // a visitor pressing Stop on an errored run must not read as a clean cancel.
  | 'run_failed';

const encoder = new TextEncoder();

// Lines longer than this go unscanned so an artifact payload can't grow the
// buffer. Failure frames are far smaller, and big frames carry content anyway.
const MAX_SCAN_LINE_CHARS = 1 << 20;

export function sseErrorFrame(code: ApiErrorCode): Uint8Array {
  return encoder.encode(
    `data: ${JSON.stringify({ error_code: code, error: FRIENDLY_MESSAGES[code] })}\n\n`
  );
}

function isFailureLine(line: string): boolean {
  // Most frames never mention an error, so spare them the JSON parse.
  if (!line.startsWith('data: ') || !line.includes('"error')) return false;
  try {
    return runErrorCode(JSON.parse(line.slice(6))) !== null;
  } catch {
    return false;
  }
}

/**
 * Line-buffers a copy of the stream, since frames (and multi-byte characters)
 * can split across chunks. Call with a chunk to scan it, or with nothing at
 * the end of the stream. Returns whether that call saw a failure event.
 */
function failureScanner(): (chunk?: Uint8Array) => boolean {
  const decoder = new TextDecoder();
  let pending = '';
  let skippingLongLine = false;

  return (chunk) => {
    const lines = (pending + decoder.decode(chunk, { stream: chunk !== undefined })).split('\n');
    pending = chunk === undefined ? '' : (lines.pop() ?? '');
    let failed = false;
    for (const line of lines) {
      if (skippingLongLine) skippingLongLine = false;
      else if (isFailureLine(line)) failed = true;
    }
    if (pending.length > MAX_SCAN_LINE_CHARS) {
      pending = '';
      skippingLongLine = true;
    }
    return failed;
  };
}

export function guardStream(
  source: ReadableStream<Uint8Array>,
  opts: {
    idleMs: number;
    maxMs: number;
    abortUpstream: () => void;
    onEnd: (outcome: StreamOutcome) => void | Promise<void>;
  }
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const scan = failureScanner();
  let runFailed = false;
  let ended = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;

  // Only latch ended flag and clear timers; return whether this call won.
  const finish = () => {
    if (ended) return false;
    ended = true;
    clearTimeout(idleTimer);
    clearTimeout(maxTimer);
    return true;
  };

  const notify = (outcome: StreamOutcome) => {
    try {
      Promise.resolve(opts.onEnd(runFailed ? 'run_failed' : outcome)).catch((e) => {
        console.error('[stream-guard] onEnd failed', e);
      });
    } catch (e) {
      console.error('[stream-guard] onEnd failed', e);
    }
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const closeWithError = (code: ApiErrorCode) => {
        try {
          controller.enqueue(sseErrorFrame(code));
          controller.close();
        } catch {
          // consumer already gone
        }
      };

      const stop = (outcome: 'idle_timeout' | 'max_duration') => {
        if (!finish()) return;
        // Cleanup first, then notify.
        opts.abortUpstream();
        reader.cancel().catch(() => {});
        closeWithError('idle_timeout');
        notify(outcome);
      };

      const armIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => stop('idle_timeout'), opts.idleMs);
      };

      armIdle();
      maxTimer = setTimeout(() => stop('max_duration'), opts.maxMs);

      void (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (ended) return;
            if (done) {
              if (!finish()) return;
              runFailed ||= scan();
              // Cleanup first, then notify.
              controller.close();
              notify('completed');
              return;
            }
            armIdle();
            // Scan first: a consumer reacting to this frame can cancel at once.
            runFailed ||= scan(value);
            controller.enqueue(value);
          }
        } catch (error) {
          if (!finish()) return;
          // Cleanup first, then notify.
          console.error('[stream-guard] upstream stream failed', error);
          closeWithError('backend_unavailable');
          notify('upstream_error');
        }
      })();
    },
    cancel() {
      if (!finish()) return reader.cancel().catch(() => {});
      // Cleanup first, then notify.
      opts.abortUpstream();
      notify('client_cancelled');
      return reader.cancel().catch(() => {});
    },
  });
}
