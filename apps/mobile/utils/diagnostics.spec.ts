import {
  reportDiagnostic,
  setCrashReporter,
  type CrashReporter,
} from './diagnostics';

describe('diagnostics', () => {
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  afterEach(() => {
    setCrashReporter(undefined);
    consoleError.mockClear();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it('forwards errors and context to the configured crash reporter', () => {
    const reporter: CrashReporter = jest.fn();
    const error = new Error('boundary failure');
    const context = { source: 'ErrorBoundary' };

    setCrashReporter(reporter);
    reportDiagnostic(error, context);

    expect(reporter).toHaveBeenCalledWith(error, context);
    expect(consoleError).toHaveBeenCalled();
  });

  it('keeps diagnostics from throwing when the crash reporter fails', () => {
    setCrashReporter(() => {
      throw new Error('reporter failure');
    });

    expect(() =>
      reportDiagnostic(new Error('original failure'), {}),
    ).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      'Crash reporter failed:',
      expect.any(Error),
    );
  });

  it('omits the raw error from production diagnostic logs', () => {
    const previousEnvironment = process.env.EXPO_PUBLIC_ENV;
    process.env.EXPO_PUBLIC_ENV = 'production';
    const error = new Error('sensitive details');
    const context = { source: 'ErrorBoundary' };

    try {
      reportDiagnostic(error, context);

      expect(consoleError).toHaveBeenCalledWith('Mobile diagnostic:', context);
      expect(consoleError).not.toHaveBeenCalledWith(
        'Mobile diagnostic:',
        context,
        error,
      );
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env.EXPO_PUBLIC_ENV;
      } else {
        process.env.EXPO_PUBLIC_ENV = previousEnvironment;
      }
    }
  });
});
