/**
 * Wraps the ADK SSE body so a stalled or runaway agent can't hold a
 * connection (and keep spending) forever, and so the route learns how the
 * stream ended, which is the only correct moment to record run completion.
 */
import { FRIENDLY_MESSAGES, type ApiErrorCode } from './api-error.ts';

export type StreamOutcome =
  | 'completed'
  | 'idle_timeout'
  | 'max_duration'
  | 'client_cancelled'
  | 'upstream_error';

const encoder = new TextEncoder();

export function sseErrorFrame(code: ApiErrorCode): Uint8Array {
  return encoder.encode(
    `data: ${JSON.stringify({ error_code: code, error: FRIENDLY_MESSAGES[code] })}\n\n`
  );
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
      Promise.resolve(opts.onEnd(outcome)).catch((e) => {
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
              // Cleanup first, then notify.
              controller.close();
              notify('completed');
              return;
            }
            armIdle();
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
