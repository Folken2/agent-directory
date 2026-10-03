import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { neonConfig } from '@neondatabase/serverless';
import { configureLocalNeon, LOCAL_DB_HOST } from './neon-local.ts';

const original = neonConfig.fetchEndpoint;

afterEach(() => {
  neonConfig.fetchEndpoint = original;
});

describe('configureLocalNeon', () => {
  it('routes the local dev host to the HTTP proxy', () => {
    assert.equal(configureLocalNeon(`postgres://postgres:postgres@${LOCAL_DB_HOST}:5433/main`), true);
    const endpoint = neonConfig.fetchEndpoint;
    assert.equal(typeof endpoint, 'function');
    assert.equal(
      (endpoint as (host: string, port: number) => string)(LOCAL_DB_HOST, 5433),
      `http://${LOCAL_DB_HOST}:4444/sql`
    );
  });

  it('leaves Neon URLs alone', () => {
    assert.equal(configureLocalNeon('postgres://u:p@ep-cool-name-123.eu-central-1.aws.neon.tech/db'), false);
    assert.equal(neonConfig.fetchEndpoint, original);
  });

  it('ignores missing or malformed URLs', () => {
    assert.equal(configureLocalNeon(undefined), false);
    assert.equal(configureLocalNeon('not a url'), false);
    assert.equal(neonConfig.fetchEndpoint, original);
  });
});
