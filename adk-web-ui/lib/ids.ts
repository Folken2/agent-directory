/**
 * IDs used across the chat surface. Two universes:
 *
 *   - SessionId is the ADK-server-facing id, prefixed with "session-".
 *   - ConversationId is the chat-UI-facing id, prefixed with "conv-".
 *
 * They share a numeric suffix (a millisecond timestamp at creation time) and
 * convert 1:1.
 *
 * Both are branded string types: they erase to plain strings at runtime, so
 * concatenation into URLs / SQL parameters / template literals all just
 * works, but the type system refuses to let you pass a SessionId where a
 * ConversationId is expected and vice versa. The constructors here are the
 * only way to mint a brand — `as SessionId` from a raw string is a code
 * smell that should appear nowhere outside this file.
 *
 * If you need to brand an external string (URL params, SQL rows), call the
 * `toSessionId` / `toConversationId` helpers; they validate the prefix and
 * throw on mismatch, so a typo doesn't silently produce a malformed id.
 */

declare const SessionIdBrand: unique symbol;
declare const ConversationIdBrand: unique symbol;

export type SessionId = string & { readonly [SessionIdBrand]: true };
export type ConversationId = string & { readonly [ConversationIdBrand]: true };

const SESSION_PREFIX = 'session-';
const CONV_PREFIX = 'conv-';

export function newConversationId(): ConversationId {
  return `${CONV_PREFIX}${Date.now()}` as ConversationId;
}

export function newSessionId(): SessionId {
  return `${SESSION_PREFIX}${Date.now()}` as SessionId;
}

/** Convert a ConversationId to its paired SessionId (1:1). */
export function toSessionId(conversationId: ConversationId | string): SessionId {
  if (!conversationId.startsWith(CONV_PREFIX)) {
    throw new Error(`Not a conversation id: ${conversationId}`);
  }
  return (SESSION_PREFIX + conversationId.slice(CONV_PREFIX.length)) as SessionId;
}

/** Convert a SessionId to its paired ConversationId (1:1). */
export function toConversationId(sessionId: SessionId | string): ConversationId {
  if (!sessionId.startsWith(SESSION_PREFIX)) {
    throw new Error(`Not a session id: ${sessionId}`);
  }
  return (CONV_PREFIX + sessionId.slice(SESSION_PREFIX.length)) as ConversationId;
}

/**
 * Brand a raw string as a SessionId after validating it. Use this at trust
 * boundaries (URL params, JSON, DB rows) where you have a `string` and need
 * to confirm it really is one before letting the typed helpers operate.
 */
export function asSessionId(value: string): SessionId {
  if (!value.startsWith(SESSION_PREFIX)) {
    throw new Error(`Not a session id: ${value}`);
  }
  return value as SessionId;
}

/** Brand a raw string as a ConversationId after validating it. */
export function asConversationId(value: string): ConversationId {
  if (!value.startsWith(CONV_PREFIX)) {
    throw new Error(`Not a conversation id: ${value}`);
  }
  return value as ConversationId;
}

export function isSessionId(value: string): value is SessionId {
  return value.startsWith(SESSION_PREFIX);
}

export function isConversationId(value: string): value is ConversationId {
  return value.startsWith(CONV_PREFIX);
}
