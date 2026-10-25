import { getIsDevelopmentMode } from './environment';
import {
  logDebug,
  logError,
  logInfo,
  logWarn,
  logWhenDevelopmentMode,
} from './logging';

jest.mock('@expo-50sdk-template/logging', () => {
  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => logger),
    logger,
    parseLogLevel: jest.fn(() => 'info'),
  };
});

jest.mock('./environment', () => ({
  getIsDevelopmentMode: jest.fn(),
}));

const mockLogger = jest.requireMock('@expo-50sdk-template/logging').logger as {
  debug: jest.Mock;
  error: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
};

describe('logging helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses empty fields when logger calls omit fields', () => {
    logDebug('debug_event');
    logInfo('info_event');
    logWarn('warn_event');
    logError('error_event');

    expect(mockLogger.debug).toHaveBeenCalledWith('debug_event', {});
    expect(mockLogger.info).toHaveBeenCalledWith('info_event', {});
    expect(mockLogger.warn).toHaveBeenCalledWith('warn_event', {});
    expect(mockLogger.error).toHaveBeenCalledWith('error_event', {});
  });

  it('writes development details only in development mode', () => {
    jest.mocked(getIsDevelopmentMode).mockReturnValue(true);
    logWhenDevelopmentMode('state', { ready: true });

    expect(mockLogger.debug).toHaveBeenCalledWith('development_log', {
      arguments: ['state', { ready: true }],
    });

    jest.clearAllMocks();
    jest.mocked(getIsDevelopmentMode).mockReturnValue(false);
    logWhenDevelopmentMode('state', { ready: false });

    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
});