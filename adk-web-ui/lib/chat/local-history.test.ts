import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ChatConversation, Message } from '../types.ts';
import {
  deserializeConversation,
  historyKey,
  loadConversation,
  saveConversation,
  serializeConversation,
} from './local-history.ts';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const msg = (i: number, content = `m${i}`): Message =>
  ({ id: `msg-${i}`, role: i % 2 ? 'assistant' : 'user', content, timestamp: new Date(1000 + i), agentName: 'a' }) as Message;

const conv = (messages: Message[]): ChatConversation =>
  ({ id: 'conv-1', title: 't', agentName: 'a', messages, createdAt: new Date(1), updatedAt: new Date(2) }) as ChatConversation;

describe('local chat history', () => {
  it('round-trips a conversation per agent with dates revived', () => {
    const s = memoryStorage();
    saveConversation(conv([msg(0), msg(1)]), s);
    assert.ok(s.map.has(historyKey('a')));
    const restored = loadConversation('a', s);
    assert.equal(restored?.messages.length, 2);
    assert.ok(restored?.messages[0].timestamp instanceof Date);
    assert.ok(restored?.createdAt instanceof Date);
    assert.equal(loadConversation('b', s), null);
  });

  it('clears the entry for an empty conversation (new chat)', () => {
    const s = memoryStorage();
    saveConversation(conv([msg(0)]), s);
    saveConversation(conv([]), s);
    assert.equal(s.map.size, 0);
  });

  it('drops the oldest messages to fit the size cap', () => {
    const big = conv([msg(0, 'x'.repeat(500)), msg(1, 'y'.repeat(500)), msg(2, 'z')]);
    const json = serializeConversation(big, 900);
    assert.ok(json && json.length <= 900);
    const restored = deserializeConversation(json!, 'a');
    assert.deepEqual(restored?.messages.map((m) => m.id), ['msg-1', 'msg-2']);
    assert.equal(serializeConversation(conv([msg(0, 'x'.repeat(5000))]), 900), null);
  });

  it('drops inline artifact payloads', () => {
    const m = { ...msg(1), artifacts: [{ id: 'a', name: 'a', type: 'image', url: 'data:' + 'A'.repeat(5000) }, { id: 'b', name: 'b', type: 'image', url: '/b' }] } as Message;
    const restored = deserializeConversation(serializeConversation(conv([m]))!, 'a');
    assert.deepEqual(restored?.messages[0].artifacts?.map((a) => a.id), ['b']);
  });

  it('ignores corrupt or mismatched entries and failing storage', () => {
    assert.equal(deserializeConversation('{bad', 'a'), null);
    assert.equal(deserializeConversation(JSON.stringify(conv([msg(0)])), 'other'), null);
    const throwing = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    assert.equal(loadConversation('a', throwing), null);
    assert.doesNotThrow(() => saveConversation(conv([msg(0)]), throwing));
  });
});
