import {
  reportDiagnostic,
  setCrashReporter,
  type CrashReporter,
} from './diagnostics';

describe('diagnostics', () => {
  let consoleError: jest.SpyInstance;

  function getLoggedEvents(): Record<string, unknown>[] {
    return consoleError.mock.calls.map((call) => {
      expect(call).toHaveLength(1);
      const [output] = call;
      expect(typeof output).toBe('string');
      return JSON.parse(output as string) as Record<string, unknown>;
    });
  }

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    setCrashReporter(undefined);
    consoleError.mockRestore();
  });

  it('forwards errors and context to the configured crash reporter', () => {
    const reporter: CrashReporter = jest.fn();
    const error = new Error('boundary failure');
    const context = { source: 'ErrorBoundary' };

    setCrashReporter(reporter);
    reportDiagnostic(error, context);

    expect(reporter).toHaveBeenCalledWith(error, context);
    expect(getLoggedEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'mobile_diagnostic',
          service: 'mobile',
          level: 'error',
          context,
        }),
      ]),
    );
  });

  it('keeps diagnostics from throwing when the crash reporter fails', () => {
    setCrashReporter(() => {
      throw new Error('reporter failure');
    });

    expect(() =>
      reportDiagnostic(new Error('original failure'), {}),
    ).not.toThrow();
    expect(getLoggedEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'crash_reporter_failed',
          service: 'mobile',
          level: 'error',
          error: expect.objectContaining({
            name: 'Error',
            message: 'reporter failure',
          }),
        }),
      ]),
    );
  });

  it('omits the raw error from production diagnostic logs', () => {
    const previousEnvironment = process.env.EXPO_PUBLIC_ENV;
    process.env.EXPO_PUBLIC_ENV = 'production';
    const error = new Error('sensitive details');
    const context = { source: 'ErrorBoundary' };

    try {
      reportDiagnostic(error, context);

      const [event] = getLoggedEvents();
      expect(event).toMatchObject({
        event: 'mobile_diagnostic',
        service: 'mobile',
        level: 'error',
        context,
      });
      expect(event).not.toHaveProperty('error');
      expect(JSON.stringify(event)).not.toContain('sensitive details');
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

      expect(getLoggedEvents()).toEqual([
        expect.objectContaining({
          event: 'mobile_diagnostic',
          service: 'mobile',
          level: 'error',
          context,
          error: expect.objectContaining({
            name: 'Error',
            message: 'development failure',
          }),
        }),
      ]);
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env.EXPO_PUBLIC_ENV;
      } else {
        process.env.EXPO_PUBLIC_ENV = previousEnvironment;
      }
    }
  });
});
