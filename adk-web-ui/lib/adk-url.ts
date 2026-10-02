/**
 * Validation + encoding for values spliced into ADK server URLs.
 * Every proxy route must build ADK paths through here: raw interpolation let
 * `../` and `?` reach other ADK endpoints.
 */
export class InvalidAdkSegmentError extends Error {
  constructor(public readonly field: string) {
    super(`Invalid ${field}`);
    this.name = 'InvalidAdkSegmentError';
  }
}

const APP_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const ID_RE = /^[A-Za-z0-9._-]{1,128}$/;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_ARTIFACT_CHARS = /[/\\\u0000-\u001f\u007f]/;

const isDotSegment = (v: string) => v === '.' || v === '..';

export function assertAppName(value: unknown): string {
  if (typeof value !== 'string' || !APP_NAME_RE.test(value)) {
    throw new InvalidAdkSegmentError('app_name');
  }
  return value;
}

export function assertId(value: unknown, field = 'session_id'): string {
  if (typeof value !== 'string' || !ID_RE.test(value) || isDotSegment(value)) {
    throw new InvalidAdkSegmentError(field);
  }
  return value;
}

export function assertArtifactName(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 255 ||
    FORBIDDEN_ARTIFACT_CHARS.test(value) ||
    isDotSegment(value)
  ) {
    throw new InvalidAdkSegmentError('artifact_name');
  }
  return value;
}

export function adkPath(...segments: string[]): string {
  return '/' + segments.map((s) => encodeURIComponent(s)).join('/');
}
