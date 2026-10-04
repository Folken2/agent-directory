import { createHash, randomBytes } from 'node:crypto';

/** The link token goes to the visitor's inbox; only its sha256 is stored. */
export type BuildToken = { token: string; hash: string };

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isBuildToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

export function hashBuildToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newBuildToken(bytes: (size: number) => Buffer = randomBytes): BuildToken {
  const token = bytes(32).toString('base64url');
  return { token, hash: hashBuildToken(token) };
}
