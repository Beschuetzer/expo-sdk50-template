import assert from 'node:assert/strict';
import test from 'node:test';

import { createLogger, parseLogLevel, type LogEntry } from './index';

test('filters entries below the configured severity threshold', () => {
  const entries: LogEntry[] = [];
  const logger = createLogger({
    level: 'warn',
    service: 'test',
    sink: (entry) => entries.push(entry),
  });

  logger.debug('debug_event');
  logger.info('info_event');
  logger.warn('warn_event');
  logger.error('error_event');

  assert.deepEqual(
    entries.map((entry) => entry.level),
    ['warn', 'error'],
  );
});

test('redacts secret fields and sensitive values nested in objects', () => {
  const entries: LogEntry[] = [];
  const logger = createLogger({
    level: 'debug',
    service: 'test',
    sink: (entry) => entries.push(entry),
  });
  logger.info('auth_event', {
    authorization: 'Bearer header-secret',
    email: 'person@example.com',
    nested: { refreshToken: 'refresh-secret' },
    contact: 'another@example.com',
    details:
      'bff_access_token=cookie-secret access_token=query-secret Bearer inline-secret code=oauth-secret mongodb://seed:database-password@localhost/test',
  });

  const output = JSON.stringify(entries[0]);
  assert.doesNotMatch(
    output,
    /header-secret|person@example\.com|refresh-secret|cookie-secret|query-secret|inline-secret|oauth-secret|database-password/,
  );
  assert.match(output, /\[REDACTED\]/);
  assert.match(output, /\[REDACTED_EMAIL\]/);
});

test('handles circular values and errors without throwing', () => {
  const entries: LogEntry[] = [];
  const logger = createLogger({
    level: 'error',
    service: 'test',
    sink: (entry) => entries.push(entry),
  });
  const fields: Record<string, unknown> = {
    error: new Error('Request failed for user@example.com'),
  };
  fields.circular = fields;

  logger.error('operation_failed', fields);

  assert.equal(entries.length, 1);
  assert.match(JSON.stringify(entries[0]), /\[Circular\]/);
  assert.doesNotMatch(JSON.stringify(entries[0]), /user@example\.com/);
});

test('supports silent mode and validates environment values', () => {
  const entries: LogEntry[] = [];
  const logger = createLogger({
    level: 'silent',
    service: 'test',
    sink: (entry) => entries.push(entry),
  });
  logger.error('suppressed_event');

  assert.equal(entries.length, 0);
  assert.equal(parseLogLevel(' WARN ', 'info'), 'warn');
  assert.equal(parseLogLevel(undefined, 'info'), 'info');
  assert.throws(() => parseLogLevel('verbose', 'info'), /LOG_LEVEL/);
});
