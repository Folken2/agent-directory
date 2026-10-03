import type { ChatConversation, Message } from '../types';

/**
 * Keeps the current conversation per agent in localStorage so a refresh
 * restores it (anonymous chats have no server-side history). Best effort:
 * storage can be missing, full or blocked, and every access is guarded.
 */

const KEY_PREFIX = 'adk-chat:';
export const MAX_STORED_BYTES = 200_000;
/** Inline artifact payloads (base64 images, PDFs) are too big to keep. */
const MAX_ARTIFACT_URL_LENGTH = 2048;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function historyKey(agentName: string): string {
  return `${KEY_PREFIX}${agentName}`;
}

function slimMessage(m: Message): Message {
  const artifacts = m.artifacts?.filter((a) => a.url.length <= MAX_ARTIFACT_URL_LENGTH);
  return { ...m, artifacts: artifacts && artifacts.length > 0 ? artifacts : undefined };
}

/**
 * JSON for storage, dropping the oldest messages until it fits `maxBytes`.
 * Returns null when not even the latest message fits.
 */
export function serializeConversation(conv: ChatConversation, maxBytes = MAX_STORED_BYTES): string | null {
  let messages = conv.messages.map(slimMessage);
  while (messages.length > 0) {
    const json = JSON.stringify({ ...conv, messages });
    if (json.length <= maxBytes) return json;
    messages = messages.slice(1);
  }
  return null;
}

export function deserializeConversation(json: string, agentName: string): ChatConversation | null {
  try {
    const raw = JSON.parse(json) as ChatConversation;
    if (!raw || typeof raw.id !== 'string' || raw.agentName !== agentName || !Array.isArray(raw.messages)) return null;
    if (raw.messages.length === 0) return null;
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      resumedFrom: undefined,
      messages: raw.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    };
  } catch {
    return null;
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadConversation(agentName: string, storage = defaultStorage()): ChatConversation | null {
  try {
    const json = storage?.getItem(historyKey(agentName));
    return json ? deserializeConversation(json, agentName) : null;
  } catch {
    return null;
  }
}

/** Save (or, for an empty conversation, clear) the agent's stored chat. */
export function saveConversation(conv: ChatConversation, storage = defaultStorage()): void {
  if (!storage) return;
  const key = historyKey(conv.agentName);
  try {
    const json = conv.messages.length > 0 ? serializeConversation(conv) : null;
    if (json) storage.setItem(key, json);
    else storage.removeItem(key);
  } catch {
    // Quota exceeded or storage blocked: keep the chat in memory only.
  }
}
