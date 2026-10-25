import { logError } from './logging';
import {
  reportDiagnostic,
  setCrashReporter,
  type CrashReporter,
} from './diagnostics';

jest.mock('./logging', () => ({
  logError: jest.fn(),
}));

describe('diagnostics', () => {
  afterEach(() => {
    setCrashReporter(undefined);
    jest.mocked(logError).mockClear();
  });

  it('forwards errors and context to the configured crash reporter', () => {
    const reporter: CrashReporter = jest.fn();
    const error = new Error('boundary failure');
    const context = { source: 'ErrorBoundary' };

    setCrashReporter(reporter);
    reportDiagnostic(error, context);

    expect(reporter).toHaveBeenCalledWith(error, context);
    expect(logError).toHaveBeenCalledWith(
      'mobile_diagnostic',
      expect.objectContaining({ context }),
    );
  });

  it('keeps diagnostics from throwing when the crash reporter fails', () => {
    setCrashReporter(() => {
      throw new Error('reporter failure');
    });

    expect(() =>
      reportDiagnostic(new Error('original failure'), {}),
    ).not.toThrow();
    expect(logError).toHaveBeenCalledWith('crash_reporter_failed', {
      error: expect.any(Error),
    });
  });

  it('omits the raw error from production diagnostic logs', () => {
    const previousEnvironment = process.env.EXPO_PUBLIC_ENV;
    process.env.EXPO_PUBLIC_ENV = 'production';
    const error = new Error('sensitive details');
    const context = { source: 'ErrorBoundary' };

    try {
      reportDiagnostic(error, context);

      expect(logError).toHaveBeenCalledWith('mobile_diagnostic', { context });
      expect(logError).not.toHaveBeenCalledWith('mobile_diagnostic', {
        context,
        error,
      });
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env.EXPO_PUBLIC_ENV;
      } else {
        process.env.EXPO_PUBLIC_ENV = previousEnvironment;
      }
    }
  });

  it('logs development diagnostics when no crash reporter is configured', () => {
    const previousEnvironment = process.env.EXPO_PUBLIC_ENV;
    process.env.EXPO_PUBLIC_ENV = 'development';
    const error = new Error('development failure');
    const context = { source: 'ErrorBoundary' };

    try {
      setCrashReporter(undefined);
      reportDiagnostic(error, context);

      expect(logError).toHaveBeenCalledWith('mobile_diagnostic', {
        context,
        error,
      });
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env.EXPO_PUBLIC_ENV;
      } else {
        process.env.EXPO_PUBLIC_ENV = previousEnvironment;
      }
    }
  });
});
