import { Platform } from 'react-native';

import { getValidAccessToken } from './tokenManager';

import { getBackendUrl } from '@/utils/helpers';
import { logDebug, logWarn } from '@/utils/logging';

type ApiError = { message?: string };
type RequestOptions = {
  fallbackErrorMessage?: (statusCode: number) => string;
};

const API_REQUEST_TIMEOUT_MS = 15_000;

export async function requestAuthenticatedJson<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const endpoint = path.startsWith('/api/v1/') ? 'api_v1' : 'other';
  const startedAt = Date.now();
  let statusCode: number | undefined;
  logDebug('api_request_started', { endpoint, method });

  const token = await getValidAccessToken().catch((error: unknown) => {
    logWarn('api_request_token_resolution_failed', {
      endpoint,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      method,
    });
    throw error;
  });
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

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    API_REQUEST_TIMEOUT_MS,
  );
  try {
    const requestInit = (): RequestInit => ({
      ...init,
      credentials: Platform.OS === 'web' ? 'include' : undefined,
      headers: new Headers(headers),
      signal: controller.signal,
    });
    let response = await fetch(`${getBackendUrl()}${path}`, requestInit());
    statusCode = response.status;

    if (response.status === 401) {
      if (Platform.OS === 'web') {
        const refreshedToken = await getValidAccessToken({
          forceRefresh: true,
        });
        if (refreshedToken) {
          response = await fetch(`${getBackendUrl()}${path}`, requestInit());
          statusCode = response.status;
        }
      } else if (token?.accessToken) {
        const refreshedToken = await getValidAccessToken({
          rejectedAccessToken: token.accessToken,
        });
        if (
          refreshedToken?.accessToken &&
          refreshedToken.accessToken !== token.accessToken
        ) {
          headers.set('authorization', `Bearer ${refreshedToken.accessToken}`);
          response = await fetch(`${getBackendUrl()}${path}`, requestInit());
          statusCode = response.status;
        }
      }
    }

    const text = await response.text();
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The API request timed out. Check the API connection.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
