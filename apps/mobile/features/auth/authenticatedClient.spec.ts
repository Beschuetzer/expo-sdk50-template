import {
  ApiRequestTimeoutError,
  requestAuthenticatedJson,
} from './authenticatedClient';
import { getValidAccessToken } from './tokenManager';

jest.mock('./tokenManager', () => ({
  getValidAccessToken: jest.fn(),
}));

jest.mock('@/utils/helpers', () => ({
  getBackendUrl: jest.fn(() => 'http://localhost:4200'),
}));

jest.mock('@/utils/logging', () => ({
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

const currentToken = {
  accessToken: 'expired-access-token',
  expiresAt: Date.now() - 1,
  idToken: 'current-id-token',
  refreshToken: 'refresh-token',
  scope: 'api:read',
  tokenType: 'Bearer' as const,
};
const refreshedToken = {
  ...currentToken,
  accessToken: 'refreshed-access-token',
  expiresAt: Date.now() + 60_000,
  idToken: 'refreshed-id-token',
};
const webSessionToken = {
  accessToken: '',
  expiresAt: Number.MAX_SAFE_INTEGER,
  idToken: 'web-refreshed-id-token',
  scope: '',
  tokenType: 'Bearer' as const,
};

function makeResponse(status: number, body: unknown): Response {
  return {
    body: null,
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function setPlatformOs(os: string) {
  Object.defineProperty(require('react-native'), 'Platform', {
    configurable: true,
    value: { OS: os },
  });
}

describe('authenticated request client', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOs('android');
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    fetchMock.mockRestore();
    setPlatformOs('android');
  });

  it('retries a native request once with the refreshed bearer token', async () => {
    jest
      .mocked(getValidAccessToken)
      .mockResolvedValueOnce(currentToken)
      .mockResolvedValueOnce(refreshedToken);
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { message: 'Token expired' }))
      .mockResolvedValueOnce(makeResponse(200, { subject: 'user-1' }));

    await expect(
      requestAuthenticatedJson<{ subject: string }>('/api/v1/me'),
    ).resolves.toEqual({
      data: { subject: 'user-1' },
      token: { idToken: 'refreshed-id-token' },
    });

    const requestSignal =
      jest.mocked(getValidAccessToken).mock.calls[0][0]?.signal;
    expect(requestSignal).toBeDefined();
    expect(getValidAccessToken).toHaveBeenNthCalledWith(1, {
      signal: requestSignal,
    });
    expect(getValidAccessToken).toHaveBeenNthCalledWith(2, {
      rejectedAccessToken: currentToken.accessToken,
      signal: requestSignal,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(requestSignal);
    expect(fetchMock.mock.calls[1][1]?.signal).toBe(requestSignal);
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get('authorization'),
    ).toBe(`Bearer ${currentToken.accessToken}`);
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).get('authorization'),
    ).toBe(`Bearer ${refreshedToken.accessToken}`);
  });

  it('does not retry when a 401 refresh returns the same access token', async () => {
    jest
      .mocked(getValidAccessToken)
      .mockResolvedValueOnce(currentToken)
      .mockResolvedValueOnce(currentToken);
    fetchMock.mockResolvedValueOnce(makeResponse(401, { message: 'Expired' }));

    await expect(
      requestAuthenticatedJson('/api/v1/me'),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Expired' });

    expect(getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips web session lookup and refreshes with cookies after a 401', async () => {
    setPlatformOs('web');
    jest.mocked(getValidAccessToken).mockResolvedValueOnce(webSessionToken);
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { message: 'Session expired' }))
      .mockResolvedValueOnce(makeResponse(200, { subject: 'web-user' }));

    await expect(
      requestAuthenticatedJson<{ subject: string }>('/api/v1/me'),
    ).resolves.toEqual({
      data: { subject: 'web-user' },
      token: { idToken: 'web-refreshed-id-token' },
    });

    const requestSignal =
      jest.mocked(getValidAccessToken).mock.calls[0][0]?.signal;
    expect(requestSignal).toBeDefined();
    expect(getValidAccessToken).toHaveBeenCalledTimes(1);
    expect(getValidAccessToken).toHaveBeenCalledWith({
      forceRefresh: true,
      signal: requestSignal,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, request] of fetchMock.mock.calls) {
      expect(request?.credentials).toBe('include');
      expect(request?.signal).toBe(requestSignal);
      expect(new Headers(request?.headers).has('authorization')).toBe(false);
    }
  });

  it('sends web requests directly with cookies and an external signal', async () => {
    setPlatformOs('web');
    fetchMock.mockResolvedValueOnce(makeResponse(200, { accepted: true }));
    const controller = new AbortController();

    await expect(
      requestAuthenticatedJson('/health', {
        method: 'POST',
        body: JSON.stringify({ ping: true }),
        signal: controller.signal,
      }),
    ).resolves.toEqual({ data: { accepted: true }, token: null });

    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4200/health',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get('content-type'),
    ).toBe('application/json');
  });

  it('preserves an explicit content type when sending a request body', async () => {
    setPlatformOs('web');
    fetchMock.mockResolvedValueOnce(makeResponse(200, { accepted: true }));

    await expect(
      requestAuthenticatedJson('/health', {
        method: 'POST',
        body: 'ping=true',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      }),
    ).resolves.toEqual({ data: { accepted: true }, token: null });

    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get('content-type'),
    ).toBe('application/x-www-form-urlencoded');
  });

  it('aborts before token lookup when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      requestAuthenticatedJson('/api/v1/me', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a native access token before making the request', async () => {
    jest.mocked(getValidAccessToken).mockResolvedValueOnce(null);

    await expect(requestAuthenticatedJson('/api/v1/me')).rejects.toThrow(
      'Authentication is required.',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not retry a web request when session refresh returns no token', async () => {
    setPlatformOs('web');
    jest.mocked(getValidAccessToken).mockResolvedValueOnce(null);
    fetchMock.mockResolvedValueOnce(
      makeResponse(401, { message: 'Session expired' }),
    );

    await expect(requestAuthenticatedJson('/api/v1/me')).rejects.toThrow(
      'Session expired',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a native request with the same rejected token', async () => {
    jest
      .mocked(getValidAccessToken)
      .mockResolvedValueOnce(currentToken)
      .mockResolvedValueOnce(currentToken);
    fetchMock.mockResolvedValueOnce(
      makeResponse(401, { message: 'Token expired' }),
    );

    await expect(requestAuthenticatedJson('/api/v1/me')).rejects.toMatchObject({
      message: 'Token expired',
      name: 'AuthenticatedRequestError',
      statusCode: 401,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback message for an unsuccessful empty response', async () => {
    jest.mocked(getValidAccessToken).mockResolvedValueOnce(currentToken);
    fetchMock.mockResolvedValueOnce({
      ...makeResponse(503, null),
      text: async () => '',
    } as Response);

    await expect(requestAuthenticatedJson('/api/v1/me')).rejects.toThrow(
      'Request failed with HTTP 503',
    );
  });

  it('preserves non-Error token lookup failures', async () => {
    jest.mocked(getValidAccessToken).mockRejectedValueOnce('lookup failure');

    await expect(requestAuthenticatedJson('/api/v1/me')).rejects.toBe(
      'lookup failure',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies the timeout to credential lookup and aborts it', async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    jest
      .mocked(getValidAccessToken)
      .mockImplementation((requestOptions = {}) => {
        requestSignal = requestOptions.signal;
        return new Promise(() => undefined);
      });

    const pendingRequest = requestAuthenticatedJson('/api/v1/me');
    const timedOut = expect(pendingRequest).rejects.toBeInstanceOf(
      ApiRequestTimeoutError,
    );
    await jest.advanceTimersByTimeAsync(15_000);

    await timedOut;
    expect(requestSignal?.aborted).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
