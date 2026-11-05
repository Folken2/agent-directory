import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { guardStream, type StreamOutcome } from './stream-guard.ts';

const enc = new TextEncoder();
const dec = new TextDecoder();

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out += dec.decode(value);
  }
}

function harness() {
  const outcomes: StreamOutcome[] = [];
  let aborted = 0;
  return {
    outcomes,
    get aborted() { return aborted; },
    opts: (idleMs: number, maxMs = 5_000) => ({
      idleMs,
      maxMs,
      abortUpstream: () => { aborted += 1; },
      onEnd: (o: StreamOutcome) => { outcomes.push(o); },
    }),
  };
}

describe('guardStream', () => {
  it('passes chunks through and reports completed', async () => {
    const h = harness();
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('data: 1\n\n'));
        c.enqueue(enc.encode('data: 2\n\n'));
        c.close();
      },
    });
    const out = await readAll(guardStream(source, h.opts(1_000)));
    assert.equal(out, 'data: 1\n\ndata: 2\n\n');
    assert.deepEqual(h.outcomes, ['completed']);
    assert.equal(h.aborted, 0);
  });

  it('aborts upstream and emits an error frame after silence', async () => {
    const h = harness();
    const source = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(enc.encode('data: first\n\n')); /* then stall forever */ },
    });
    const out = await readAll(guardStream(source, h.opts(30)));
    assert.match(out, /^data: first\n\n/);
    assert.match(out, /"error_code":"idle_timeout"/);
    assert.deepEqual(h.outcomes, ['idle_timeout']);
    assert.equal(h.aborted, 1);
  });

  it('enforces the total duration even while chunks keep flowing', async () => {
    const h = harness();
    let timer: ReturnType<typeof setInterval> | undefined;
    const source = new ReadableStream<Uint8Array>({
      start(c) { timer = setInterval(() => c.enqueue(enc.encode(':\n')), 5); },
      cancel() { clearInterval(timer); },
    });
    const out = await readAll(guardStream(source, h.opts(1_000, 40)));
    clearInterval(timer);
    assert.match(out, /"error_code":"idle_timeout"/);
    assert.deepEqual(h.outcomes, ['max_duration']);
  });

  it('reports client_cancelled and aborts upstream when the reader cancels', async () => {
    const h = harness();
    const source = new ReadableStream<Uint8Array>({ start() { /* stall */ } });
    const guarded = guardStream(source, h.opts(1_000));
    await guarded.getReader().cancel();
    assert.deepEqual(h.outcomes, ['client_cancelled']);
    assert.equal(h.aborted, 1);
  });

  it('reports upstream_error when the source errors', async (t) => {
    t.mock.method(console, 'error', () => {});
    const h = harness();
    const source = new ReadableStream<Uint8Array>({
      start(c) { c.error(new Error('socket hang up')); },
    });
    const out = await readAll(guardStream(source, h.opts(1_000)));
    assert.match(out, /"error_code":"backend_unavailable"/);
    assert.deepEqual(h.outcomes, ['upstream_error']);
  });

  it('onEnd throws on completed → stream still closes', async (t) => {
    const errorLog: Array<{ msg: string; err: unknown }> = [];
    t.mock.method(console, 'error', (msg: string, err: unknown) => {
      errorLog.push({ msg, err });
    });
    const h = harness();
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('data: ok\n\n'));
        c.close();
      },
    });
    const opts = h.opts(1_000);
    const originalOnEnd = opts.onEnd;
    opts.onEnd = (o: StreamOutcome) => {
      originalOnEnd(o);
      throw new Error('onEnd broke');
    };
    const out = await readAll(guardStream(source, opts));
    assert.equal(out, 'data: ok\n\n');
    assert.deepEqual(h.outcomes, ['completed']);
    assert.equal(errorLog.length, 1);
    assert.match(String((errorLog[0]?.err as Error)?.message), /onEnd broke/);
  });

  it('onEnd throws on idle timeout → error frame sent and abortUpstream called', async (t) => {
    const errorLog: Array<{ msg: string; err: unknown }> = [];
    t.mock.method(console, 'error', (msg: string, err: unknown) => {
      errorLog.push({ msg, err });
    });
    const h = harness();
    const source = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(enc.encode('data: first\n\n')); },
    });
    const opts = h.opts(30);
    const originalOnEnd = opts.onEnd;
    opts.onEnd = (o: StreamOutcome) => {
      originalOnEnd(o);
      throw new Error('onEnd broke');
    };
    const out = await readAll(guardStream(source, opts));
    assert.match(out, /^data: first\n\n/);
    assert.match(out, /"error_code":"idle_timeout"/);
    assert.deepEqual(h.outcomes, ['idle_timeout']);
    assert.equal(h.aborted, 1);
    assert.equal(errorLog.length, 1);
    assert.match(String((errorLog[0]?.err as Error)?.message), /onEnd broke/);
  });

  describe('failure events in the stream', () => {
    const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;
    const camelCaseFailure = frame({ author: 'agent', errorCode: '402', errorMessage: 'Payment Required' });
    const exceptionFrame = frame({ error: 'ClientError: 402 Payment Required' });

    function sourceOf(chunks: Array<string | Uint8Array>) {
      return new ReadableStream<Uint8Array>({
        start(c) {
          for (const chunk of chunks) c.enqueue(typeof chunk === 'string' ? enc.encode(chunk) : chunk);
          c.close();
        },
      });
    }

    async function outcomeOf(chunks: Array<string | Uint8Array>) {
      const h = harness();
      const out = await readAll(guardStream(sourceOf(chunks), h.opts(1_000)));
      return { out, outcomes: h.outcomes };
    }

    it('reports run_failed for a contentless errorCode event and passes it through', async () => {
      const { out, outcomes } = await outcomeOf([frame({ content: { parts: [{ text: 'Hi' }] } }), camelCaseFailure]);
      assert.ok(out.endsWith(camelCaseFailure));
      assert.deepEqual(outcomes, ['run_failed']);
    });

    it('reports run_failed for an {"error": ...} frame', async () => {
      const { out, outcomes } = await outcomeOf([exceptionFrame]);
      assert.equal(out, exceptionFrame);
      assert.deepEqual(outcomes, ['run_failed']);
    });

    it('treats errorCode on an event with content as a finish reason', async () => {
      const { outcomes } = await outcomeOf([
        frame({ errorCode: 'MAX_TOKENS', content: { parts: [{ text: 'Cut off here' }] } }),
      ]);
      assert.deepEqual(outcomes, ['completed']);
    });

    it('reports run_failed for a finish reason on an event with no content', async () => {
      const { outcomes } = await outcomeOf([frame({ errorCode: 'MAX_TOKENS', content: { parts: [] } })]);
      assert.deepEqual(outcomes, ['run_failed']);
    });

    it('ignores "error" that only appears in reply text or nested tool results', async () => {
      const { outcomes } = await outcomeOf([
        frame({ content: { parts: [{ text: 'an "error": "text" in a reply' }] } }),
        frame({ content: { parts: [{ functionResponse: { response: { error: 'tool said no' } } }] } }),
        'data: not json "error"\n\n',
        'data: null\n\n',
      ]);
      assert.deepEqual(outcomes, ['completed']);
    });

    it('detects a frame split across chunks, one byte at a time, unchanged', async () => {
      const bytes = enc.encode(camelCaseFailure);
      const { out, outcomes } = await outcomeOf(Array.from(bytes, (b) => Uint8Array.of(b)));
      assert.equal(out, camelCaseFailure);
      assert.deepEqual(outcomes, ['run_failed']);
    });

    it('survives a multi-byte character split across chunks', async () => {
      const bytes = enc.encode(frame({ error: 'fallo en la petición ✗' }));
      const middle = bytes.indexOf(0xe2) + 1; // inside the 3-byte ✗
      const { outcomes } = await outcomeOf([bytes.slice(0, middle), bytes.slice(middle)]);
      assert.deepEqual(outcomes, ['run_failed']);
    });

    it('detects a final frame with no trailing newline', async () => {
      const { outcomes } = await outcomeOf([exceptionFrame.trimEnd()]);
      assert.deepEqual(outcomes, ['run_failed']);
    });

    it('stays failed when a later event carries content', async () => {
      const { outcomes } = await outcomeOf([exceptionFrame, frame({ content: { parts: [{ text: 'Hi' }] } })]);
      assert.deepEqual(outcomes, ['run_failed']);
    });

    it('still finds failures after an oversized line it skipped', async () => {
      const big = frame({ error: 'x'.repeat(1 << 21) });
      const skipped = await outcomeOf([big.slice(0, 1 << 20), big.slice(1 << 20, -2), big.slice(-2)]);
      assert.deepEqual(skipped.outcomes, ['completed']);
      assert.equal(skipped.out, big);
      const after = await outcomeOf([big.slice(0, -2), big.slice(-2), exceptionFrame]);
      assert.deepEqual(after.outcomes, ['run_failed']);
    });

    it('reports run_failed when the reader cancels after seeing the failure', async () => {
      const h = harness();
      const source = new ReadableStream<Uint8Array>({
        start(c) { c.enqueue(enc.encode(exceptionFrame)); /* then stall */ },
      });
      const reader = guardStream(source, h.opts(1_000)).getReader();
      await reader.read();
      await reader.cancel();
      assert.deepEqual(h.outcomes, ['run_failed']);
      assert.equal(h.aborted, 1);
    });

    it('reports run_failed when the failure is followed by silence', async () => {
      const h = harness();
      const source = new ReadableStream<Uint8Array>({
        start(c) { c.enqueue(enc.encode(exceptionFrame)); /* then stall */ },
      });
      await readAll(guardStream(source, h.opts(30)));
      assert.deepEqual(h.outcomes, ['run_failed']);
    });
  });
});
