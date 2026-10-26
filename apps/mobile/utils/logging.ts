import {
  createLogger,
  parseLogLevel,
  type LogFields,
} from '@expo-50sdk-template/logging';

import { getIsDevelopmentMode } from './environment';

const logger = createLogger({
  level: parseLogLevel(
    process.env.EXPO_PUBLIC_LOG_LEVEL,
    'info',
    'EXPO_PUBLIC_LOG_LEVEL',
  ),
  service: 'mobile',
});

export function logDebug(event: string, fields: LogFields = {}): void {
  logger.debug(event, fields);
}

export function logInfo(event: string, fields: LogFields = {}): void {
  logger.info(event, fields);
}

export function logWarn(event: string, fields: LogFields = {}): void {
  logger.warn(event, fields);
}

export function logError(event: string, fields: LogFields = {}): void {
  logger.error(event, fields);
}

export function logWhenDevelopmentMode(
  ...args: Parameters<typeof console.log>
): void {
  if (getIsDevelopmentMode()) {
    logger.debug('development_log', { arguments: args });
  }
}
