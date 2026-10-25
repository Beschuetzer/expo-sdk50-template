import type { DiscoveryDocument } from 'expo-auth-session';
import { Platform } from 'react-native';

import {
  fetchIdentityProviderDiscovery,
  normalizeIdentityProviderDiscovery,
  refreshAccessToken,
} from './client';
import {
  ApiRequestTimeoutError,
  AUTH_REQUEST_TIMEOUT_MS,
  DefinitiveOAuthRejectionError,
  MissingTokenEndpointError,
  RefreshOutcomeUnknownError,
} from './errors';
import {
  clearAuthenticatedSession,
  getAccessTokenSessionRevision,
  loadAccessToken,
  persistRefreshedAccessTokenIfCurrent,
  type StoredAccessToken,
} from './storage';
import {
  getAccessTokenExpiry,
  getValidAccessToken,
  MissingRefreshTokenError,
  subscribeToAccessTokenExpiry,
  subscribeToRefreshOutcomeUnknown,
} from './tokenManager';
import { beginWebSessionLogout } from './webSession';

import { logWarn } from '@/utils/logging';
import { getIdentityProviderUrl } from '@/utils/platform';

jest.mock('./client', () => ({
  fetchIdentityProviderDiscovery: jest.fn(),
  normalizeIdentityProviderDiscovery: jest.fn((discovery) => discovery),
  refreshAccessToken: jest.fn(),
}));

jest.mock('@/utils/logging', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

jest.mock('./storage', () => ({
  isAccessTokenExpiring: jest.fn(
    (token: { expiresAt: number }) => token.expiresAt <= Date.now() + 30_000,
  ),
  getAccessTokenSessionRevision: jest.fn(),
  loadAccessToken: jest.fn(),
  persistRefreshedAccessTokenIfCurrent: jest.fn(),
  clearAuthenticatedSession: jest.fn(),
}));

jest.mock('@/utils/platform', () => ({
  getIdentityProviderUrl: jest.fn(),
}));

describe('access-token manager', () => {
  let storedToken: StoredAccessToken | null;
  let sessionRevision: number;

  const makeToken = (
    overrides: Partial<StoredAccessToken> = {},
  ): StoredAccessToken => ({
    accessToken: 'access-token',
    expiresAt: Date.now() + 60_000,
    refreshToken: 'refresh-token',
    scope: 'api:read',
    tokenType: 'Bearer',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });
    storedToken = makeToken();
    sessionRevision = 0;
    jest
      .mocked(getAccessTokenSessionRevision)
      .mockImplementation(() => sessionRevision);
    jest.mocked(loadAccessToken).mockImplementation(async () => storedToken);
    jest
      .mocked(persistRefreshedAccessTokenIfCurrent)
      .mockImplementation(async (refreshedToken, originalToken, revision) => {
        if (revision !== sessionRevision || !storedToken) return false;
        if (
          storedToken.accessToken !== originalToken.accessToken ||
          storedToken.refreshToken !== originalToken.refreshToken
        ) {
          return false;
        }
        storedToken = refreshedToken;
        return true;
      });
    jest.mocked(clearAuthenticatedSession).mockImplementation(async () => {
      storedToken = null;
      sessionRevision += 1;
    });
    jest.mocked(fetchIdentityProviderDiscovery).mockResolvedValue({
      tokenEndpoint: 'https://identity.example.com/token',
    } as DiscoveryDocument);
    jest
      .mocked(getIdentityProviderUrl)
      .mockReturnValue(`https://identity.example.com/${Math.random()}`);
    jest
      .mocked(normalizeIdentityProviderDiscovery)
      .mockImplementation((discovery) => discovery);
    jest
      .mocked(refreshAccessToken)
      .mockImplementation(async () =>
        makeToken({ accessToken: 'refreshed-access-token' }),
      );
  });

  it('returns a token that is outside the refresh safety window', async () => {
    const token = makeToken();
    storedToken = token;

    await expect(getValidAccessToken()).resolves.toEqual(token);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('reads the current expiry from token storage without refreshing', async () => {
    const token = makeToken();
    storedToken = token;

    await expect(getAccessTokenExpiry()).resolves.toBe(token.expiresAt);
    expect(loadAccessToken).toHaveBeenCalledTimes(1);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes a token near expiry and persists the replacement', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({
      accessToken: 'refreshed-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    storedToken = expiredSoon;
    jest.mocked(refreshAccessToken).mockResolvedValue(refreshed);
    const expiryListener = jest.fn();
    const unsubscribe = subscribeToAccessTokenExpiry(expiryListener);

    try {
      await expect(getValidAccessToken()).resolves.toEqual(refreshed);
      expect(expiryListener).toHaveBeenCalledWith(refreshed.expiresAt);
    } finally {
      unsubscribe();
    }

    const networkSignal = jest.mocked(fetchIdentityProviderDiscovery).mock
      .calls[0][1];
    expect(networkSignal).toBeDefined();
    expect(refreshAccessToken).toHaveBeenCalledWith(
      expiredSoon,
      expect.objectContaining({
        tokenEndpoint: 'https://identity.example.com/token',
      }),
      networkSignal,
    );
    expect(persistRefreshedAccessTokenIfCurrent).toHaveBeenCalledWith(
      refreshed,
      expiredSoon,
      0,
      networkSignal,
    );
    expect(storedToken).toEqual(refreshed);
  });

  it('passes request cancellation through discovery, refresh, and persistence', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({ accessToken: 'refreshed-access-token' });
    const controller = new AbortController();
    storedToken = expiredSoon;
    jest.mocked(refreshAccessToken).mockResolvedValue(refreshed);

    await expect(
      getValidAccessToken({ signal: controller.signal }),
    ).resolves.toEqual(refreshed);

    const networkSignal = jest.mocked(fetchIdentityProviderDiscovery).mock
      .calls[0][1];
    expect(networkSignal).toBeDefined();
    expect(networkSignal).not.toBe(controller.signal);
    expect(refreshAccessToken).toHaveBeenCalledWith(
      expiredSoon,
      expect.objectContaining({
        tokenEndpoint: 'https://identity.example.com/token',
      }),
      networkSignal,
    );
    expect(persistRefreshedAccessTokenIfCurrent).toHaveBeenCalledWith(
      refreshed,
      expiredSoon,
      0,
      networkSignal,
    );
  });

  it('rejects when discovery is cancelled while pending', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const controller = new AbortController();
    storedToken = expiredSoon;
    let networkSignal: AbortSignal | undefined;
    jest
      .mocked(fetchIdentityProviderDiscovery)
      .mockImplementationOnce((_issuerUrl, signal) => {
        networkSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        });
      });

    const pendingRequest = getValidAccessToken({ signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    await expect(pendingRequest).rejects.toMatchObject({ name: 'AbortError' });
    expect(networkSignal?.aborted).toBe(true);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('keeps a shared refresh alive while another caller is waiting', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({ accessToken: 'refreshed-access-token' });
    const firstController = new AbortController();
    const secondController = new AbortController();
    let resolveDiscovery!: (discovery: DiscoveryDocument) => void;
    let networkSignal: AbortSignal | undefined;
    storedToken = expiredSoon;
    jest
      .mocked(fetchIdentityProviderDiscovery)
      .mockImplementationOnce((_issuerUrl, signal) => {
        networkSignal = signal;
        return new Promise((resolve) => {
          resolveDiscovery = resolve;
        });
      });
    jest.mocked(refreshAccessToken).mockResolvedValue(refreshed);

    const firstRequest = getValidAccessToken({
      signal: firstController.signal,
    });
    const secondRequest = getValidAccessToken({
      signal: secondController.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchIdentityProviderDiscovery).toHaveBeenCalledTimes(1);

    firstController.abort();
    await expect(firstRequest).rejects.toMatchObject({ name: 'AbortError' });
    expect(networkSignal?.aborted).toBe(false);

    resolveDiscovery({
      tokenEndpoint: 'https://identity.example.com/token',
    } as DiscoveryDocument);
    await expect(secondRequest).resolves.toEqual(refreshed);
  });

  it('finishes an in-flight refresh after its last caller cancels', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({
      accessToken: 'refreshed-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    const controller = new AbortController();
    let resolveRefresh!: (token: StoredAccessToken) => void;
    let resolvePersistence!: () => void;
    let refreshSignal: AbortSignal | undefined;
    const persistenceStarted = new Promise<void>((resolve) => {
      resolvePersistence = resolve;
    });
    storedToken = expiredSoon;
    jest
      .mocked(refreshAccessToken)
      .mockImplementationOnce((_token, _discovery, signal) => {
        refreshSignal = signal;
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      });
    jest
      .mocked(persistRefreshedAccessTokenIfCurrent)
      .mockImplementationOnce(
        async (nextToken, originalToken, revision, signal) => {
          if (
            revision !== sessionRevision ||
            !storedToken ||
            signal?.aborted ||
            storedToken.accessToken !== originalToken.accessToken ||
            storedToken.refreshToken !== originalToken.refreshToken
          ) {
            return false;
          }
          storedToken = nextToken;
          resolvePersistence();
          return true;
        },
      );

    const request = getValidAccessToken({ signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);

    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(refreshSignal?.aborted).toBe(false);

    resolveRefresh(refreshed);
    await persistenceStarted;

    expect(refreshSignal?.aborted).toBe(false);
    expect(storedToken).toEqual(refreshed);
    expect(persistRefreshedAccessTokenIfCurrent).toHaveBeenCalledWith(
      refreshed,
      expiredSoon,
      0,
      refreshSignal,
    );
  });

  it('finishes queued persistence after its last caller cancels', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({
      accessToken: 'refreshed-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    const controller = new AbortController();
    let resolveCommit!: () => void;
    let resolvePersistenceStarted!: () => void;
    const persistenceStarted = new Promise<void>((resolve) => {
      resolvePersistenceStarted = resolve;
    });
    storedToken = expiredSoon;
    jest.mocked(refreshAccessToken).mockResolvedValueOnce(refreshed);
    jest.mocked(persistRefreshedAccessTokenIfCurrent).mockImplementationOnce(
      (nextToken, originalToken, revision, signal) =>
        new Promise((resolve) => {
          resolveCommit = () => {
            if (
              revision !== sessionRevision ||
              !storedToken ||
              signal?.aborted ||
              storedToken.accessToken !== originalToken.accessToken ||
              storedToken.refreshToken !== originalToken.refreshToken
            ) {
              resolve(false);
              return;
            }
            storedToken = nextToken;
            resolve(true);
          };
          resolvePersistenceStarted();
        }),
    );

    const request = getValidAccessToken({ signal: controller.signal });
    await persistenceStarted;
    const refreshSignal = jest.mocked(refreshAccessToken).mock.calls[0][2];

    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(refreshSignal?.aborted).toBe(false);

    resolveCommit();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(storedToken).toEqual(refreshed);
    expect(persistRefreshedAccessTokenIfCurrent).toHaveBeenCalledWith(
      refreshed,
      expiredSoon,
      0,
      refreshSignal,
    );
  });

  it('bounds native refreshes and clears sessions after uncertain outcomes', async () => {
    jest.useFakeTimers();
    const token = makeToken({ expiresAt: Date.now() + 10_000 });
    let refreshSignal: AbortSignal | undefined;
    storedToken = token;
    jest
      .mocked(refreshAccessToken)
      .mockImplementationOnce((_token, _discovery, signal) => {
        refreshSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        });
      });

    try {
      const request = getValidAccessToken();
      const timedOut = expect(request).rejects.toBeInstanceOf(
        RefreshOutcomeUnknownError,
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);

      await timedOut;
      expect(refreshSignal?.aborted).toBe(true);
      expect(clearAuthenticatedSession).toHaveBeenCalledTimes(1);
      await expect(getValidAccessToken()).resolves.toBeNull();
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('notifies auth state after a refresh becomes unknown despite waiter abort', async () => {
    jest.useFakeTimers();
    const token = makeToken({ expiresAt: Date.now() + 10_000 });
    const waiterController = new AbortController();
    const onRefreshOutcomeUnknown = jest.fn();
    const unsubscribe = subscribeToRefreshOutcomeUnknown(
      onRefreshOutcomeUnknown,
    );
    let refreshSignal: AbortSignal | undefined;
    storedToken = token;
    jest
      .mocked(refreshAccessToken)
      .mockImplementationOnce((_token, _discovery, signal) => {
        refreshSignal = signal;
        return new Promise(() => undefined);
      });

    try {
      const request = getValidAccessToken({
        signal: waiterController.signal,
      });
      const requestOutcome = expect(request).rejects.toMatchObject({
        name: 'AbortError',
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);

      waiterController.abort();
      await requestOutcome;
      await jest.advanceTimersByTimeAsync(0);
      expect(refreshSignal?.aborted).toBe(false);
      expect(clearAuthenticatedSession).not.toHaveBeenCalled();
      expect(onRefreshOutcomeUnknown).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
      expect(refreshSignal?.aborted).toBe(true);
      expect(clearAuthenticatedSession).toHaveBeenCalledTimes(1);
      expect(onRefreshOutcomeUnknown).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      jest.useRealTimers();
    }
  });

  it('notifies auth state while session cleanup is pending', async () => {
    const onRefreshOutcomeUnknown = jest.fn();
    const unsubscribe = subscribeToRefreshOutcomeUnknown(
      onRefreshOutcomeUnknown,
    );
    let finishClear!: () => void;
    storedToken = makeToken({ expiresAt: Date.now() + 10_000 });
    jest.mocked(clearAuthenticatedSession).mockImplementationOnce(() => {
      storedToken = null;
      sessionRevision += 1;
      return new Promise<void>((resolve) => {
        finishClear = resolve;
      });
    });
    jest
      .mocked(refreshAccessToken)
      .mockRejectedValueOnce(new TypeError('Network request failed.'));

    try {
      await expect(getValidAccessToken()).rejects.toBeInstanceOf(
        RefreshOutcomeUnknownError,
      );
      expect(onRefreshOutcomeUnknown).toHaveBeenCalledTimes(1);

      storedToken = makeToken({ accessToken: 'replacement-access-token' });
      sessionRevision += 1;
      finishClear();
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(storedToken?.accessToken).toBe('replacement-access-token');
      expect(onRefreshOutcomeUnknown).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('continues notifying listeners when another listener throws', async () => {
    const nonErrorFailure: unknown = 'Listener failed.';
    const errorListener = jest.fn(() => {
      throw new Error('Listener failed.');
    });
    const nonErrorListener = jest.fn(() => {
      throw nonErrorFailure;
    });
    const finalListener = jest.fn();
    const unsubscribeError = subscribeToRefreshOutcomeUnknown(errorListener);
    const unsubscribeNonError =
      subscribeToRefreshOutcomeUnknown(nonErrorListener);
    const unsubscribeFinal = subscribeToRefreshOutcomeUnknown(finalListener);
    storedToken = makeToken({ expiresAt: Date.now() + 10_000 });
    jest
      .mocked(refreshAccessToken)
      .mockRejectedValueOnce(new TypeError('Network request failed.'));

    try {
      await expect(getValidAccessToken()).rejects.toBeInstanceOf(
        RefreshOutcomeUnknownError,
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(nonErrorListener).toHaveBeenCalledTimes(1);
      expect(finalListener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribeError();
      unsubscribeNonError();
      unsubscribeFinal();
    }
  });

  it('notifies auth state immediately when session cleanup fails', async () => {
    const onRefreshOutcomeUnknown = jest.fn();
    const unsubscribe = subscribeToRefreshOutcomeUnknown(
      onRefreshOutcomeUnknown,
    );
    storedToken = makeToken({ expiresAt: Date.now() + 10_000 });
    jest.mocked(clearAuthenticatedSession).mockImplementationOnce(async () => {
      storedToken = null;
      sessionRevision += 1;
      throw new Error('Persisted query cache clear failed.');
    });
    jest
      .mocked(refreshAccessToken)
      .mockRejectedValueOnce(new TypeError('Network request failed.'));

    try {
      await expect(getValidAccessToken()).rejects.toBeInstanceOf(
        RefreshOutcomeUnknownError,
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(onRefreshOutcomeUnknown).toHaveBeenCalledTimes(1);
      expect(storedToken).toBeNull();
      expect(logWarn).toHaveBeenCalledWith(
        'auth_access_token_session_clear_failed',
        { errorName: 'Error' },
      );
    } finally {
      unsubscribe();
    }
  });

  it('reports failed cleanup after notifying when a newer session is stored', async () => {
    const onRefreshOutcomeUnknown = jest.fn();
    const unsubscribe = subscribeToRefreshOutcomeUnknown(
      onRefreshOutcomeUnknown,
    );
    let rejectClear!: (error: Error) => void;
    storedToken = makeToken({ expiresAt: Date.now() + 10_000 });
    jest.mocked(clearAuthenticatedSession).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          storedToken = null;
          sessionRevision += 1;
          rejectClear = reject;
        }),
    );
    jest
      .mocked(refreshAccessToken)
      .mockRejectedValueOnce(new TypeError('Network request failed.'));

    try {
      await expect(getValidAccessToken()).rejects.toBeInstanceOf(
        RefreshOutcomeUnknownError,
      );
      expect(onRefreshOutcomeUnknown).toHaveBeenCalledTimes(1);
      expect(logWarn).not.toHaveBeenCalledWith(
        'auth_access_token_session_clear_failed',
        { errorName: 'Error' },
      );

      storedToken = makeToken({ accessToken: 'replacement-access-token' });
      sessionRevision += 1;
      rejectClear(new Error('Persisted query cache clear failed.'));
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(onRefreshOutcomeUnknown).toHaveBeenCalledTimes(1);
      expect(logWarn).toHaveBeenCalledWith(
        'auth_access_token_session_clear_failed',
        { errorName: 'Error' },
      );
    } finally {
      unsubscribe();
    }
  });

  it('clears the current session after a native refresh transport failure', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    storedToken = expiredSoon;
    jest
      .mocked(refreshAccessToken)
      .mockRejectedValueOnce(new TypeError('Network request failed.'));

    await expect(getValidAccessToken()).rejects.toBeInstanceOf(
      RefreshOutcomeUnknownError,
    );
    expect(clearAuthenticatedSession).toHaveBeenCalledTimes(1);
    expect(storedToken).toBeNull();
  });

  it('preserves the session when native discovery has no token endpoint', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    storedToken = expiredSoon;
    jest
      .mocked(fetchIdentityProviderDiscovery)
      .mockResolvedValueOnce({} as DiscoveryDocument);

    await expect(getValidAccessToken()).rejects.toBeInstanceOf(
      MissingTokenEndpointError,
    );

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(clearAuthenticatedSession).not.toHaveBeenCalled();
    expect(storedToken).toEqual(expiredSoon);
  });

  it('preserves the current session after a definitive OAuth rejection', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const rejection = new DefinitiveOAuthRejectionError(
      'invalid_grant',
      'The refresh token is invalid.',
    );
    storedToken = expiredSoon;
    jest.mocked(refreshAccessToken).mockRejectedValueOnce(rejection);

    await expect(getValidAccessToken()).rejects.toBe(rejection);
    expect(clearAuthenticatedSession).not.toHaveBeenCalled();
    expect(storedToken).toEqual(expiredSoon);
  });

  it('bounds web refreshes and clears sessions after uncertain outcomes', async () => {
    jest.useFakeTimers();
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    let refreshSignal: AbortSignal | undefined;
    jest
      .mocked(refreshAccessToken)
      .mockImplementationOnce((_token, _discovery, signal) => {
        refreshSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        });
      });

    try {
      const request = getValidAccessToken({ forceRefresh: true });
      const timedOut = expect(request).rejects.toBeInstanceOf(
        RefreshOutcomeUnknownError,
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);

      await timedOut;
      expect(refreshSignal?.aborted).toBe(true);
      expect(clearAuthenticatedSession).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('invalidates a rotated token when persistence exceeds the deadline', async () => {
    jest.useFakeTimers();
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({
      accessToken: 'refreshed-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    let resolveCommit!: () => void;
    let resolvePersistenceStarted!: () => void;
    const persistenceStarted = new Promise<void>((resolve) => {
      resolvePersistenceStarted = resolve;
    });
    storedToken = expiredSoon;
    jest.mocked(refreshAccessToken).mockResolvedValueOnce(refreshed);
    jest.mocked(persistRefreshedAccessTokenIfCurrent).mockImplementationOnce(
      (nextToken, originalToken, revision, signal) =>
        new Promise((resolve) => {
          resolveCommit = () => {
            if (
              revision !== sessionRevision ||
              !storedToken ||
              signal?.aborted ||
              storedToken.accessToken !== originalToken.accessToken ||
              storedToken.refreshToken !== originalToken.refreshToken
            ) {
              resolve(false);
              return;
            }
            storedToken = nextToken;
            resolve(true);
          };
          resolvePersistenceStarted();
        }),
    );

    try {
      const request = getValidAccessToken();
      const timedOut = expect(request).rejects.toBeInstanceOf(
        RefreshOutcomeUnknownError,
      );
      await jest.advanceTimersByTimeAsync(0);
      await persistenceStarted;
      await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);

      await timedOut;
      expect(clearAuthenticatedSession).toHaveBeenCalledTimes(1);
      expect(storedToken).toBeNull();

      resolveCommit();
      await Promise.resolve();
      expect(storedToken).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not invalidate a session when timeout occurs before exchange', async () => {
    jest.useFakeTimers();
    storedToken = makeToken({ expiresAt: Date.now() + 10_000 });
    jest
      .mocked(fetchIdentityProviderDiscovery)
      .mockImplementationOnce(() => new Promise(() => {}));

    try {
      const request = getValidAccessToken();
      const timedOut = expect(request).rejects.toBeInstanceOf(
        ApiRequestTimeoutError,
      );
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);

      await timedOut;
      expect(refreshAccessToken).not.toHaveBeenCalled();
      expect(clearAuthenticatedSession).not.toHaveBeenCalled();
      expect(storedToken).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('coalesces concurrent refreshes for the same access token', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({ accessToken: 'refreshed-access-token' });
    storedToken = expiredSoon;
    let resolveRefresh!: (token: StoredAccessToken) => void;
    jest.mocked(refreshAccessToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const firstRequest = getValidAccessToken();
    const secondRequest = getValidAccessToken();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    resolveRefresh(refreshed);
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      refreshed,
      refreshed,
    ]);
  });

  it('does not restore a refreshed token after the session is cleared', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({ accessToken: 'refreshed-access-token' });
    storedToken = expiredSoon;
    let resolveRefresh!: (token: StoredAccessToken) => void;
    jest.mocked(refreshAccessToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingRequest = getValidAccessToken();
    await new Promise((resolve) => setTimeout(resolve, 0));
    storedToken = null;
    sessionRevision += 1;
    resolveRefresh(refreshed);

    await expect(pendingRequest).resolves.toBeNull();
    expect(persistRefreshedAccessTokenIfCurrent).toHaveBeenCalledWith(
      refreshed,
      expiredSoon,
      0,
      expect.any(AbortSignal),
    );
  });

  it('forces refresh when the API rejects the current access token', async () => {
    const token = makeToken();
    const refreshed = makeToken({ accessToken: 'refreshed-access-token' });
    storedToken = token;
    jest.mocked(refreshAccessToken).mockResolvedValue(refreshed);

    await expect(
      getValidAccessToken({ rejectedAccessToken: token.accessToken }),
    ).resolves.toEqual(refreshed);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('uses a newer stored token when an older request receives a 401', async () => {
    const newerToken = makeToken({ accessToken: 'newer-access-token' });
    storedToken = newerToken;

    await expect(
      getValidAccessToken({ rejectedAccessToken: 'older-access-token' }),
    ).resolves.toEqual(newerToken);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('skips refresh when there is no session or refresh credential', async () => {
    storedToken = null;
    await expect(
      getValidAccessToken({ forceRefresh: true }),
    ).resolves.toBeNull();

    const expiredToken = makeToken({
      expiresAt: Date.now() - 1,
      refreshToken: undefined,
    });
    storedToken = expiredToken;

    await expect(getValidAccessToken()).resolves.toEqual(expiredToken);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a forced refresh when no refresh credential is available', async () => {
    storedToken = makeToken({ refreshToken: undefined });

    await expect(getValidAccessToken({ forceRefresh: true })).rejects.toThrow(
      MissingRefreshTokenError,
    );
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('reuses identity-provider discovery for the same issuer', async () => {
    const firstToken = makeToken({
      accessToken: 'first-refreshed-token',
      refreshToken: 'first-refresh-token',
    });
    const secondToken = makeToken({
      accessToken: 'second-refreshed-token',
      refreshToken: 'second-refresh-token',
    });
    jest
      .mocked(getIdentityProviderUrl)
      .mockReturnValue('https://identity.example.com/stable-issuer');
    jest
      .mocked(refreshAccessToken)
      .mockResolvedValueOnce(firstToken)
      .mockResolvedValueOnce(secondToken);

    await expect(getValidAccessToken({ forceRefresh: true })).resolves.toEqual(
      firstToken,
    );
    await expect(getValidAccessToken({ forceRefresh: true })).resolves.toEqual(
      secondToken,
    );

    expect(fetchIdentityProviderDiscovery).toHaveBeenCalledTimes(1);
  });

  it('does not refresh web cookie sessions', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    const token = makeToken({ expiresAt: Date.now() - 60_000 });
    storedToken = token;

    await expect(getValidAccessToken()).resolves.toEqual(token);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('coalesces forced web session refreshes', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    storedToken = null;
    const refreshed = makeToken({
      accessToken: '',
      expiresAt: Number.MAX_SAFE_INTEGER,
      refreshToken: undefined,
    });
    jest.mocked(refreshAccessToken).mockResolvedValue(refreshed);

    const firstRefresh = getValidAccessToken({ forceRefresh: true });
    const secondRefresh = getValidAccessToken({ forceRefresh: true });

    await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toEqual([
      refreshed,
      refreshed,
    ]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    const networkSignal = jest.mocked(fetchIdentityProviderDiscovery).mock
      .calls[0][1];
    expect(refreshAccessToken).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        tokenEndpoint: 'https://identity.example.com/token',
      }),
      networkSignal,
    );
    expect(persistRefreshedAccessTokenIfCurrent).not.toHaveBeenCalled();
  });

  it('returns the replacement session when a web refresh becomes stale', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    storedToken = null;
    const replacementToken = makeToken({
      accessToken: 'replacement-access-token',
      refreshToken: 'replacement-refresh-token',
    });
    const staleRefreshToken = makeToken({
      accessToken: '',
      expiresAt: Number.MAX_SAFE_INTEGER,
      refreshToken: undefined,
    });
    let resolveRefresh!: (token: StoredAccessToken) => void;
    jest.mocked(refreshAccessToken).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingRefresh = getValidAccessToken({ forceRefresh: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    storedToken = replacementToken;
    sessionRevision += 1;
    resolveRefresh(staleRefreshToken);

    await expect(pendingRefresh).resolves.toEqual(replacementToken);
  });

  it('cancels a pending web refresh without probing cookies during logout', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    storedToken = null;
    let resolveRefresh!: (token: StoredAccessToken) => void;
    jest.mocked(refreshAccessToken).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingRefresh = getValidAccessToken({ forceRefresh: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);

    sessionRevision += 1;
    const webLogout = beginWebSessionLogout();
    const rejectedRefresh = expect(pendingRefresh).rejects.toMatchObject({
      name: 'AbortError',
    });
    try {
      await webLogout.waitForPendingRefreshes();
      await rejectedRefresh;

      expect(loadAccessToken).toHaveBeenCalledTimes(1);
      expect(clearAuthenticatedSession).not.toHaveBeenCalled();
    } finally {
      webLogout.release();
      resolveRefresh(
        makeToken({
          accessToken: '',
          expiresAt: Number.MAX_SAFE_INTEGER,
          refreshToken: undefined,
        }),
      );
    }
  });
});
