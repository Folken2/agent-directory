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
});
