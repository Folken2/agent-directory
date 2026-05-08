/**
 * IDs used across the chat surface. Two universes:
 *
 *   - SessionId is the ADK-server-facing id, prefixed with "session-".
 *   - ConversationId is the chat-UI-facing id, prefixed with "conv-".
 *
 * They share a numeric suffix (a millisecond timestamp at creation time) and
 * convert 1:1. Before this module, the conversion lived as
 * `id.replace('conv-', 'session-')` sprinkled across the codebase, with no
 * single owner — adding a new id type meant grepping for that string. Use
 * these helpers everywhere instead, and add new conversion functions here
 * rather than inlining string surgery at the callsite.
 *
 * Branded types are intentionally NOT applied yet — the codebase still has
 * many `string` IDs in flight (zustand store, types.ts) and a brand would
 * cascade into a much larger PR. This module is a small, safe foundation
 * that the rest of the refactor leans on.
 */

const SESSION_PREFIX = 'session-';
const CONV_PREFIX = 'conv-';

export function newConversationId(): string {
  return `${CONV_PREFIX}${Date.now()}`;
}

export function newSessionId(): string {
  return `${SESSION_PREFIX}${Date.now()}`;
}

export function toSessionId(conversationId: string): string {
  if (!conversationId.startsWith(CONV_PREFIX)) {
    throw new Error(`Not a conversation id: ${conversationId}`);
  }
  return SESSION_PREFIX + conversationId.slice(CONV_PREFIX.length);
}

export function toConversationId(sessionId: string): string {
  if (!sessionId.startsWith(SESSION_PREFIX)) {
    throw new Error(`Not a session id: ${sessionId}`);
  }
  return CONV_PREFIX + sessionId.slice(SESSION_PREFIX.length);
}

export function isSessionId(value: string): boolean {
  return value.startsWith(SESSION_PREFIX);
}

export function isConversationId(value: string): boolean {
  return value.startsWith(CONV_PREFIX);
}
