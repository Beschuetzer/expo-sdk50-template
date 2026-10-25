import {
  createLogger,
  parseLogLevel,
  type LogFields,
  type Logger,
} from '@expo-50sdk-template/logging';

let logger: Logger | undefined;

function getLogger(): Logger {
  const logLevel = parseLogLevel(process.env.LOG_LEVEL, 'info');
  if (!logger) {
    logger = createLogger({
      level: logLevel,
      service: 'api',
    });
  }

  return logger;
}

export function logDebug(event: string, fields: LogFields = {}) {
  getLogger().debug(event, fields);
}

export function logInfo(event: string, fields: LogFields = {}) {
  getLogger().info(event, fields);
}

export function logWarn(event: string, fields: LogFields = {}) {
  getLogger().warn(event, fields);
}

export function logError(event: string, fields: LogFields = {}) {
  getLogger().error(event, fields);
}
