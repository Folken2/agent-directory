import type { Artifact, MapsCapture } from '../types';
import type { GuideDocument } from '../guide/types';
import type { Build } from '../build/types';
import { parseBuild } from '../build/parse';
import { filterInternalInstructions } from '../instruction-filter';
import { mergeGuideWithCaptures } from '../guide/merge';
import { parseGuideDocument } from '../guide/parse';

/**
 * Structured pieces of an assistant message. The chat renders each one
 * through the renderer registry (components/chat/renderers), so a new output
 * type (e.g. the builder's build card) is one entry here plus one renderer.
 */
export type MessagePayload =
  | { type: 'text'; text: string }
  | { type: 'artifact'; artifacts: Artifact[] }
  | { type: 'maps'; captures: MapsCapture[] }
  | { type: 'guide'; document: GuideDocument }
  | { type: 'build'; build: Build };

export type PayloadType = MessagePayload['type'];

/** Text shown for a raw model reply: unwraps JSON envelopes and hides prompt leakage. */
export function getDisplayContent(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const trimmed = (typeof raw === 'string' ? raw : JSON.stringify(raw)).trim();
  if (!trimmed) return '';

  let text = trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const keys = Object.keys(obj);
      // An artifacts-only envelope has no text of its own.
      if (Array.isArray(obj.artifacts) && keys.every((k) => k === 'artifacts')) return '';
      const field = [obj.response, obj.text, obj.message].find((v) => typeof v === 'string') as string | undefined;
      if (field !== undefined) text = field.trim();
    }
  } catch {
    // Not JSON: plain text.
  }
  return filterInternalInstructions(text);
}

/**
 * Split a message into renderable payloads. A valid guide document replaces
 * the text/artifact/maps rendering; it is re-validated because stored or
 * rehydrated messages may carry a stale shape.
 * A valid build adds its card and takes its zip out of the generic artifact
 * list (the card downloads it).
 */
export function messagePayloads(message: {
  content: unknown;
  artifacts?: Artifact[];
  mapsCaptures?: MapsCapture[];
  guideDocument?: unknown;
  build?: unknown;
}): MessagePayload[] {
  const guide = message.guideDocument ? parseGuideDocument(message.guideDocument) : null;
  if (guide) return [{ type: 'guide', document: mergeGuideWithCaptures(guide, message.mapsCaptures ?? []) }];

  const payloads: MessagePayload[] = [];
  const text = getDisplayContent(message.content);
  if (text) payloads.push({ type: 'text', text });
  const build = message.build ? parseBuild(message.build) : null;
  if (build) payloads.push({ type: 'build', build });
  const artifacts = (message.artifacts ?? []).filter((a) => !build || a.name !== build.artifact);
  if (artifacts.length) payloads.push({ type: 'artifact', artifacts });
  if (message.mapsCaptures?.length) payloads.push({ type: 'maps', captures: message.mapsCaptures });
  return payloads;
}
