import { requestAuthenticatedJson } from './authenticatedClient';
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
  refreshToken: 'refresh-token',
  scope: 'api:read',
  tokenType: 'Bearer' as const,
};
const refreshedToken = {
  ...currentToken,
  accessToken: 'refreshed-access-token',
  expiresAt: Date.now() + 60_000,
};
const webSessionToken = {
  accessToken: '',
  expiresAt: Number.MAX_SAFE_INTEGER,
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
    ).resolves.toEqual({ subject: 'user-1' });

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

  it('refreshes the web BFF session and retries with cookies after a 401', async () => {
    setPlatformOs('web');
    jest
      .mocked(getValidAccessToken)
      .mockResolvedValueOnce(webSessionToken)
      .mockResolvedValueOnce(webSessionToken);
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { message: 'Session expired' }))
      .mockResolvedValueOnce(makeResponse(200, { subject: 'web-user' }));

    await expect(
      requestAuthenticatedJson<{ subject: string }>('/api/v1/me'),
    ).resolves.toEqual({ subject: 'web-user' });

    const requestSignal =
      jest.mocked(getValidAccessToken).mock.calls[0][0]?.signal;
    expect(requestSignal).toBeDefined();
    expect(getValidAccessToken).toHaveBeenNthCalledWith(1, {
      signal: requestSignal,
    });
    expect(getValidAccessToken).toHaveBeenNthCalledWith(2, {
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
    const timedOut = expect(pendingRequest).rejects.toThrow(
      'The API request timed out. Check the API connection.',
    );
    await jest.advanceTimersByTimeAsync(15_000);

    await timedOut;
    expect(requestSignal?.aborted).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
