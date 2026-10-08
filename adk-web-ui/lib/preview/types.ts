/**
 * Live preview of the agent the builder is building: the project's own server
 * running in an E2B sandbox, reached only through `/api/preview` → the ADK
 * backend's preview proxy (agents/adk_agent_builder/preview_api.py).
 */

import type { ApiErrorCode } from '../api-error';

/** `state["builder:preview"]` written by the builder's start/stop tools. */
export type PreviewState = {
  status: 'running' | 'stopped';
  project?: string;
  package?: string;
  startedAt?: string;
};

export const PREVIEW_STATE_KEY = 'builder:preview';
export const MAX_PREVIEW_TEXT = 4000;
const PREVIEW_SESSION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** Validated `state_delta["builder:preview"]`, or null. */
export function parsePreviewState(raw: unknown): PreviewState | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (value.status !== 'running' && value.status !== 'stopped') return null;
  const text = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : undefined);
  return {
    status: value.status,
    project: text(value.project),
    package: text(value.package),
    startedAt: text(value.startedAt),
  };
}

export type PreviewRun = { previewSessionId: string; text: string };

/** The body of `POST /api/preview`, or an error message. */
export function parsePreviewRun(body: unknown): PreviewRun | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'body must be an object' };
  const { previewSessionId, text } = body as Record<string, unknown>;
  if (typeof previewSessionId !== 'string' || !PREVIEW_SESSION_ID.test(previewSessionId)) {
    return { error: 'invalid previewSessionId' };
  }
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_PREVIEW_TEXT) {
    return { error: 'invalid text' };
  }
  return { previewSessionId, text };
}

/** The backend proxy's error for the user: code and a plain message. */
export function previewError(status: number): { code: ApiErrorCode; message: string } {
  switch (status) {
    case 404:
      return { code: 'not_found', message: 'The preview is not running. Ask the builder to start it.' };
    case 410:
      return { code: 'not_found', message: 'The preview stopped after a while idle. Ask the builder to start it again.' };
    case 429:
      return { code: 'rate_limited', message: 'This preview has used its messages. Ask the builder to restart it.' };
    default:
      return { code: 'backend_unavailable', message: 'The preview could not be reached. Try again in a moment.' };
  }
}
