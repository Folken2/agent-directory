import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { missingEnv, envWarnings } from './env.ts';

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
    ]);
  });
});

describe('envWarnings', () => {
  it('warns when ADK_INTERNAL_TOKEN is unset in production', () => {
    assert.deepEqual(envWarnings({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), [
      'ADK_INTERNAL_TOKEN is not set; backend calls are not authenticated',
    ]);
  });
  it('does not warn when ADK_INTERNAL_TOKEN is set in production', () => {
    assert.deepEqual(envWarnings({ NODE_ENV: 'production', ADK_INTERNAL_TOKEN: 't' } as NodeJS.ProcessEnv), []);
  });
  it('does not warn in development even without ADK_INTERNAL_TOKEN', () => {
    assert.deepEqual(envWarnings({ NODE_ENV: 'development' } as NodeJS.ProcessEnv), []);
  });
});
