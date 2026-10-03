import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { missingEnv } from './env.ts';

const FULL = {
  DATABASE_URL: 'postgres://x',
  ADK_SERVER_URL: 'http://x',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  AUTH_SECRET: 's',
  ADK_INTERNAL_TOKEN: 't',
  NODE_ENV: 'production',
} as NodeJS.ProcessEnv;

describe('missingEnv', () => {
  it('passes with everything set', () => {
    assert.deepEqual(missingEnv(FULL), []);
  });
  it('accepts NEXTAUTH_SECRET instead of AUTH_SECRET', () => {
    assert.deepEqual(missingEnv({ ...FULL, AUTH_SECRET: undefined, NEXTAUTH_SECRET: 's' }), []);
  });
  it('lists every missing variable', () => {
    assert.deepEqual(missingEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), [
      'DATABASE_URL',
      'ADK_SERVER_URL',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'AUTH_SECRET (or NEXTAUTH_SECRET)',
      'ADK_INTERNAL_TOKEN',
    ]);
  });
  it('does not require the internal token outside production', () => {
    assert.deepEqual(missingEnv({ ...FULL, ADK_INTERNAL_TOKEN: undefined, NODE_ENV: 'development' }), []);
  });
});
