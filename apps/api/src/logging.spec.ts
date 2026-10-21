import assert from 'node:assert/strict';
import test from 'node:test';

import { logInfo } from './logging';

test('redacts authorization data from structured logs', () => {
  const originalLog = console.log;
  let output = '';
  console.log = ((value?: unknown) => {
    output = String(value);
  }) as typeof console.log;

  try {
    logInfo('auth_test', {
      authorization: 'Bearer access-secret',
      cookie: 'bff_access_token=cookie-secret',
      nested: { refresh_token: 'refresh-secret' },
      details:
        'Bearer inline-secret access_token=query-secret code=oauth-secret',
    });
  } finally {
    console.log = originalLog;
  }

  assert.doesNotMatch(output, /access-secret|cookie-secret|refresh-secret/);
  assert.doesNotMatch(output, /query-secret|oauth-secret|inline-secret/);
  assert.match(output, /\[REDACTED\]/);
});
