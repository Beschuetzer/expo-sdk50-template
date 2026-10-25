export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

export class ApiRequestTimeoutError extends Error {
  constructor() {
    super();
    this.name = 'ApiRequestTimeoutError';
  }
}

export class DefinitiveOAuthRejectionError extends Error {
  constructor(
    readonly oauthErrorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'DefinitiveOAuthRejectionError';
  }
}

export class RefreshOutcomeUnknownError extends ApiRequestTimeoutError {
  constructor() {
    super();
    this.name = 'RefreshOutcomeUnknownError';
  }
}
