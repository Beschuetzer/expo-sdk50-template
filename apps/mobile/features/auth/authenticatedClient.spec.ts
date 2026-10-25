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

    expect(getValidAccessToken).toHaveBeenNthCalledWith(1);
    expect(getValidAccessToken).toHaveBeenNthCalledWith(2, {
      rejectedAccessToken: currentToken.accessToken,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

    expect(getValidAccessToken).toHaveBeenNthCalledWith(1);
    expect(getValidAccessToken).toHaveBeenNthCalledWith(2, {
      forceRefresh: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, request] of fetchMock.mock.calls) {
      expect(request?.credentials).toBe('include');
      expect(new Headers(request?.headers).has('authorization')).toBe(false);
    }
  });
});
