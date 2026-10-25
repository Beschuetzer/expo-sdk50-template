export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogEntryLevel = Exclude<LogLevel, 'silent'>;
export type LogFields = Record<string, unknown>;

export type LogEntry = {
  timestamp: string;
  service: string;
  level: LogEntryLevel;
  event: string;
  [key: string]: unknown;
};

export type Logger = {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
};

export type LoggerOptions = {
  level: LogLevel;
  service: string;
  sink?: (entry: LogEntry) => void;
};

const levelPriority: Record<Exclude<LogLevel, 'silent'>, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const sensitiveKeyPattern =
  /^(?:access_?token|id_?token|refresh_?token|token|authorization|cookie|set_cookie|client_secret|secret|password|passwd|credential|credentials|code|code_verifier|nonce|state|email|phone|subject|user_id|userid|session_id|sessionid|api_key|private_key|signature)$/i;

const secretTextPattern =
  /(^|[^a-z0-9])((?:access[_-]?token|id[_-]?token|refresh[_-]?token|token|code[_-]?verifier|client[_-]?secret|password|authorization|cookie|code))=([^&\s]+)/gi;
const credentialUrlPattern =
  /\b((?:mongodb(?:\+srv)?|https?):\/\/)[^/\s:@]+:[^@\s/]+@/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\bBearer\s+[^\s,;]+/gi;
const MAX_DEPTH = 8;
const MAX_COLLECTION_ITEMS = 100;

export function parseLogLevel(
  value: string | undefined,
  fallback: LogLevel,
  variableName = 'LOG_LEVEL',
): LogLevel {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;

  for (const level of LOG_LEVELS) {
    if (level === normalized) return level;
  }

  throw new Error(`${variableName} must be one of: ${LOG_LEVELS.join(', ')}`);
}

function redactString(value: string): string {
  return value
    .replace(bearerPattern, 'Bearer [REDACTED]')
    .replace(secretTextPattern, '$1$2=[REDACTED]')
    .replace(credentialUrlPattern, '$1[REDACTED]@')
    .replace(emailPattern, '[REDACTED_EMAIL]');
}

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  key?: string,
): unknown {
  if (key && sensitiveKeyPattern.test(normalizeKey(key))) {
    return '[REDACTED]';
  }
  if (typeof value === 'string') return redactString(value);
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'symbol' || typeof value === 'function') {
    return `[${typeof value}]`;
  }
  if (depth >= MAX_DEPTH) return '[Max depth reached]';
  if (seen.has(value)) return '[Circular]';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }

  seen.add(value);
  if (value instanceof Error) {
    return {
      name: redactString(value.name),
      message: redactString(value.message),
      ...(value.stack ? { stack: redactString(value.stack) } : {}),
    };
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_COLLECTION_ITEMS)
      .map((item) => sanitizeValue(item, seen, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [entryKey, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  ).slice(0, MAX_COLLECTION_ITEMS)) {
    if (!descriptor.enumerable) continue;
    result[entryKey] =
      'value' in descriptor
        ? sanitizeValue(descriptor.value, seen, depth + 1, entryKey)
        : '[Accessor]';
  }
  return result;
}

function defaultSink(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  switch (entry.level) {
    case 'debug':
      console.debug(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
}

export function createLogger(options: LoggerOptions): Logger {
  const sink = options.sink ?? defaultSink;

  function write(level: LogEntryLevel, event: string, fields: LogFields = {}) {
    if (
      options.level === 'silent' ||
      levelPriority[level] < levelPriority[options.level]
    ) {
      return;
    }

    const safeFields = sanitizeValue(fields, new WeakSet(), 0) as LogFields;
    sink({
      ...safeFields,
      timestamp: new Date().toISOString(),
      service: options.service,
      level,
      event: redactString(event),
    });
  }

  return {
    debug: (event, fields) => write('debug', event, fields),
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}
