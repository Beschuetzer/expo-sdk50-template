import assert from 'node:assert/strict';
import test from 'node:test';

import { logInfo } from './logging';

test('redacts authorization data from structured logs', () => {
  const originalInfo = console.info;
  const originalLogLevel = process.env.LOG_LEVEL;
  let output = '';
  process.env.LOG_LEVEL = 'debug';
  console.info = ((value?: unknown) => {
    output = String(value);
  }) as typeof console.info;

  try {
    logInfo('auth_test', {
      authorization: 'Bearer access-secret',
      cookie: 'bff_access_token=cookie-secret',
      nested: { refresh_token: 'refresh-secret' },
      details:
        'Bearer inline-secret access_token=query-secret code=oauth-secret',
    });
  } finally {
    console.info = originalInfo;
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  }

  assert.doesNotMatch(output, /access-secret|cookie-secret|refresh-secret/);
  assert.doesNotMatch(output, /query-secret|oauth-secret|inline-secret/);
  assert.match(output, /\[REDACTED\]/);
});
