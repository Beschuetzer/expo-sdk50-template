import { getIsDevelopmentMode } from './environment';
import { logError } from './logging';

export type CrashReporter = (
  error: unknown,
  context: Record<string, unknown>,
) => void;

let crashReporter: CrashReporter | undefined;

export function setCrashReporter(reporter: CrashReporter | undefined): void {
  crashReporter = reporter;
}

export function reportDiagnostic(
  error: unknown,
  context: Record<string, unknown>,
): void {
  try {
    crashReporter?.(error, context);
  } catch (reporterError) {
    logError('crash_reporter_failed', { error: reporterError });
  }

  if (getIsDevelopmentMode()) {
    logError('mobile_diagnostic', { context, error });
  } else {
    logError('mobile_diagnostic', { context });
  }
}
