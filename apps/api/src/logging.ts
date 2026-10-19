type LogFields = Record<string, unknown>;

const sensitiveKeys = new Set([
  'access_token',
  'authorization',
  'client_secret',
  'code',
  'code_verifier',
  'cookie',
  'id_token',
  'refresh_token',
  'token',
]);

function redact(value: unknown, key?: string): unknown {
  if (key && sensitiveKeys.has(key.toLowerCase())) return '[REDACTED]';
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
      .replace(
        /\b(access_token|id_token|refresh_token|code|code_verifier|client_secret)=[^&\s]+/gi,
        '$1=[REDACTED]',
      );
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function write(level: 'error' | 'info', event: string, fields: LogFields) {
  const entry = JSON.stringify({
    event,
    level,
    timestamp: new Date().toISOString(),
    ...(redact(fields) as LogFields),
  });

  if (level === 'error') {
    console.error(entry);
  } else {
    console.log(entry);
  }
}

export function logError(event: string, fields: LogFields = {}) {
  write('error', event, fields);
}

export function logInfo(event: string, fields: LogFields = {}) {
  write('info', event, fields);
}
