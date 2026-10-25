export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

export class ApiRequestTimeoutError extends Error {
  constructor() {
    super();
    this.name = 'ApiRequestTimeoutError';
  }
}

export class RefreshOutcomeUnknownError extends ApiRequestTimeoutError {
  constructor() {
    super();
    this.name = 'RefreshOutcomeUnknownError';
  }
}
