import { Platform } from 'react-native';

import { awaitWithAbort, throwIfAborted } from './abort';
import { ApiRequestTimeoutError, AUTH_REQUEST_TIMEOUT_MS } from './errors';
import { getValidAccessToken } from './tokenManager';

import { getBackendUrl } from '@/utils/helpers';
import { logDebug, logWarn } from '@/utils/logging';

export { ApiRequestTimeoutError };

type ApiError = { message?: string };
type RequestOptions = {
  fallbackErrorMessage?: (statusCode: number) => string;
};

export async function requestAuthenticatedJson<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const endpoint = path.startsWith('/api/v1/') ? 'api_v1' : 'other';
  const startedAt = Date.now();
  let statusCode: number | undefined;
  let requestTimedOut = false;
  logDebug('api_request_started', { endpoint, method });

  const controller = new AbortController();
  const signal = controller.signal;
  const externalSignal = init.signal ?? undefined;
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', abortFromExternalSignal, {
      once: true,
    });
  }
  const timeoutId = setTimeout(() => {
    requestTimedOut = true;
    controller.abort();
  }, AUTH_REQUEST_TIMEOUT_MS);

  try {
    throwIfAborted(signal);
    let token;
    try {
      token = await awaitWithAbort(getValidAccessToken({ signal }), signal);
    } catch (error) {
      logWarn('api_request_token_resolution_failed', {
        endpoint,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        method,
      });
      throw error;
    }

    const headers = new Headers(init.headers);
    if (init.body !== undefined) {
      headers.set('content-type', 'application/json');
    }
    if (Platform.OS !== 'web') {
      if (!token?.accessToken) {
        logWarn('api_request_blocked', {
          endpoint,
          method,
          reason: 'missing_authentication',
        });
        throw new Error('Authentication is required.');
      }
      headers.set('authorization', `Bearer ${token.accessToken}`);
    }

    const requestInit = (): RequestInit => ({
      ...init,
      credentials: Platform.OS === 'web' ? 'include' : undefined,
      headers: new Headers(headers),
      signal,
    });
    let response = await awaitWithAbort(
      fetch(`${getBackendUrl()}${path}`, requestInit()),
      signal,
    );
    statusCode = response.status;

    if (response.status === 401) {
      if (Platform.OS === 'web') {
        const refreshedToken = await awaitWithAbort(
          getValidAccessToken({ forceRefresh: true, signal }),
          signal,
        );
        if (refreshedToken) {
          response = await awaitWithAbort(
            fetch(`${getBackendUrl()}${path}`, requestInit()),
            signal,
          );
          statusCode = response.status;
        }
      } else if (token?.accessToken) {
        const refreshedToken = await awaitWithAbort(
          getValidAccessToken({
            rejectedAccessToken: token.accessToken,
            signal,
          }),
          signal,
        );
        if (
          refreshedToken?.accessToken &&
          refreshedToken.accessToken !== token.accessToken
        ) {
          headers.set('authorization', `Bearer ${refreshedToken.accessToken}`);
          response = await awaitWithAbort(
            fetch(`${getBackendUrl()}${path}`, requestInit()),
            signal,
          );
          statusCode = response.status;
        }
      }
    }

    const text = await awaitWithAbort(response.text(), signal);
    const result = text ? (JSON.parse(text) as T & ApiError) : undefined;
    if (!response.ok) {
      throw new Error(
        result && typeof result.message === 'string'
          ? result.message
          : options.fallbackErrorMessage?.(response.status) ??
            `Request failed with HTTP ${response.status}`,
      );
    }
    logDebug('api_request_completed', {
      durationMs: Date.now() - startedAt,
      endpoint,
      method,
      statusCode,
    });
    return result as T;
  } catch (error) {
    logWarn('api_request_failed', {
      durationMs: Date.now() - startedAt,
      endpoint,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      method,
      ...(statusCode ? { statusCode } : {}),
    });
    if (requestTimedOut) {
      throw new ApiRequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}
