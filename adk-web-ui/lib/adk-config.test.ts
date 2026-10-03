import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adkFetch, adkHeaders, adkServerUrl } from './adk-config';
import { ensureAdkSession } from './adk-session';

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let responses: Array<Response | Error> = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  responses = [];
  process.env.ADK_SERVER_URL = 'http://backend.railway.internal:8080/';
  process.env.ADK_INTERNAL_TOKEN = 'secret';
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next ?? new Response('{}', { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.ADK_SERVER_URL;
  delete process.env.ADK_INTERNAL_TOKEN;
});

describe('adk-config', () => {
  it('strips trailing slashes from the base url', () => {
    assert.equal(adkServerUrl(), 'http://backend.railway.internal:8080');
  });
  it('adds the internal token header', () => {
    assert.equal(adkHeaders()['X-Internal-Token'], 'secret');
    delete process.env.ADK_INTERNAL_TOKEN;
    assert.equal(adkHeaders()['X-Internal-Token'], undefined);
  });
  it('adkFetch prefixes the base url and merges headers', async () => {
    await adkFetch('/list-apps', { headers: { 'Content-Type': 'application/json' } });
    assert.equal(calls[0].url, 'http://backend.railway.internal:8080/list-apps');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers['X-Internal-Token'], 'secret');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.ok(calls[0].init.signal === undefined);
  });
  it('adkFetch attaches a timeout signal when asked', async () => {
    await adkFetch('/x', { timeoutMs: 50 });
    assert.ok(calls[0].init.signal instanceof AbortSignal);
  });
});

describe('ensureAdkSession', () => {
  it('is ok when the session exists', async () => {
    responses = [new Response('{}', { status: 200 })];
    assert.equal(await ensureAdkSession('my_agent', 'u_1', 'session-1'), 'ok');
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/apps\/my_agent\/users\/u_1\/sessions\/session-1$/);
  });
  it('creates the session on 404', async () => {
    responses = [new Response('', { status: 404 }), new Response('{}', { status: 200 })];
    assert.equal(await ensureAdkSession('my_agent', 'u_1', 'session-1'), 'ok');
    assert.equal(calls[1].init.method, 'POST');
    assert.equal(calls[1].init.body, JSON.stringify({ session_id: 'session-1' }));
  });
  it('is unavailable when creation fails or the backend is down', async () => {
    responses = [new Response('', { status: 404 }), new Response('', { status: 500 })];
    assert.equal(await ensureAdkSession('my_agent', 'u_1', 'session-1'), 'unavailable');
    responses = [new Error('ECONNREFUSED')];
    assert.equal(await ensureAdkSession('my_agent', 'u_1', 'session-1'), 'unavailable');
  });
});
