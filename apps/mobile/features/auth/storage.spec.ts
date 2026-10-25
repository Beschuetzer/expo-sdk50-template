import type { DiscoveryDocument } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

import { refreshAccessToken } from './client';
import { ApiRequestTimeoutError, AUTH_REQUEST_TIMEOUT_MS } from './errors';
import {
  clearAccessToken,
  clearAuthenticatedSession,
  getAccessTokenSessionRevision,
  loadAccessToken,
  persistRefreshedAccessTokenIfCurrent,
  saveAccessToken,
  type StoredAccessToken,
} from './storage';

import { clearPersistedQueryCache } from '@/state/queryClient';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('@/utils/helpers', () => ({
  getBackendUrl: jest.fn(() => 'http://localhost:4200'),
}));

jest.mock('@/state/queryClient', () => ({
  clearPersistedQueryCache: jest.fn(),
}));

describe('access-token storage', () => {
  const token: StoredAccessToken = {
    accessToken: 'access-token',
    expiresAt: Date.now() + 60_000,
    scope: 'api:read',
    tokenType: 'Bearer',
  };
  const secureStoreValues = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    secureStoreValues.clear();
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) => secureStoreValues.get(key) ?? null);
    jest
      .mocked(SecureStore.setItemAsync)
      .mockImplementation(async (key, value) => {
        secureStoreValues.set(key, value);
      });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
      secureStoreValues.delete(key);
    });
    jest.mocked(SecureStore.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(clearPersistedQueryCache).mockResolvedValue(undefined);
  });

  it('saves and loads a valid native token', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify(token));

    await saveAccessToken(token);
    await expect(loadAccessToken()).resolves.toEqual(token);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'expo50sdktemplate.oauth.access-token',
      JSON.stringify({ ...token, storageVersion: 2 }),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  });

  it('returns null when no native token is stored', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

    await expect(loadAccessToken()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('clears expired tokens', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(
        JSON.stringify({ ...token, expiresAt: Date.now() - 1 }),
      );

    await expect(loadAccessToken()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'expo50sdktemplate.oauth.access-token',
    );
  });

  it('clears malformed tokens', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('{not-json');

    await expect(loadAccessToken()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('clears stored values that parse to a non-token value', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('null');

    await expect(loadAccessToken()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'expo50sdktemplate.oauth.access-token',
    );
  });

  it('clears records with invalid required token fields', async () => {
    const invalidTokens: unknown[] = [
      false,
      { ...token, accessToken: 123 },
      { ...token, tokenType: 'MAC' },
      { ...token, scope: 123 },
      { ...token, expiresAt: 'later' },
    ];

    for (const invalidToken of invalidTokens) {
      jest
        .mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce(JSON.stringify(invalidToken));

      await expect(loadAccessToken()).resolves.toBeNull();
    }

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(
      invalidTokens.length * 2,
    );
  });

  it('retains an expired access token when a refresh token is available', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({
        ...token,
        expiresAt: Date.now() - 1,
        refreshToken: 'refresh-token',
      }),
    );

    await expect(loadAccessToken()).resolves.toEqual({
      ...token,
      expiresAt: expect.any(Number),
      refreshToken: 'refresh-token',
    });
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('stores the ID token separately from the access-token record', async () => {
    const tokenWithIdToken = {
      ...token,
      idToken: 'id-token',
    };
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) =>
        key === 'expo50sdktemplate.oauth.id-token'
          ? 'id-token'
          : JSON.stringify({ ...token, storageVersion: 2 }),
      );

    await saveAccessToken(tokenWithIdToken);
    await expect(loadAccessToken()).resolves.toEqual(tokenWithIdToken);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'expo50sdktemplate.oauth.id-token',
      'id-token',
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  });

  it('loads versioned tokens when the separate ID token is absent', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValueOnce(JSON.stringify({ ...token, storageVersion: 2 }))
      .mockResolvedValueOnce(null);

    await expect(loadAccessToken()).resolves.toEqual(token);
  });

  it('returns null for expired web tokens and clears them', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });

    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);

    await expect(loadAccessToken()).resolves.toBeNull();
    await expect(clearAccessToken()).resolves.toBeUndefined();
  });

  it('uses and clears the BFF web session without secure storage', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);

    await saveAccessToken(token);
    await expect(loadAccessToken()).resolves.toEqual({
      accessToken: '',
      expiresAt: Number.MAX_SAFE_INTEGER,
      scope: '',
      tokenType: 'Bearer',
    });
    await clearAccessToken();
    await expect(loadAccessToken()).resolves.toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('passes cancellation to web session reads', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    const signal = new AbortController().signal;
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);

    await expect(loadAccessToken({ signal })).resolves.toMatchObject({
      accessToken: '',
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:4200/auth/session',
      expect.objectContaining({ credentials: 'include', signal }),
    );
  });

  it('clears cookies after a pending web refresh applies its response cookies', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    let cookie = 'original-refresh-cookie';
    let resolveRefresh!: (response: Response) => void;
    const requestOrder: string[] = [];
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh')) {
          requestOrder.push('refresh-started');
          return new Promise((resolve) => {
            resolveRefresh = (response) => {
              cookie = 'rotated-refresh-cookie';
              requestOrder.push('refresh-set-cookie');
              resolve(response);
            };
          });
        }
        if (url.endsWith('/auth/logout')) {
          requestOrder.push('logout');
          cookie = '';
          return Promise.resolve({ ok: true } as Response);
        }
        if (url.endsWith('/auth/session')) {
          return Promise.resolve({ ok: cookie.length > 0 } as Response);
        }
        throw new Error(`Unexpected request: ${url}`);
      });

    try {
      const refresh = refreshAccessToken(
        undefined,
        {} as DiscoveryDocument,
      );
      const clearing = clearAccessToken();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(requestOrder).toEqual(['refresh-started']);

      resolveRefresh({
        json: async () => ({
          expires_in: 900,
          token_type: 'Bearer',
        }),
        ok: true,
      } as Response);
      await expect(refresh).resolves.toMatchObject({ accessToken: '' });
      await clearing;

      expect(requestOrder).toEqual([
        'refresh-started',
        'refresh-set-cookie',
        'logout',
      ]);
      expect(cookie).toBe('');
      await expect(loadAccessToken()).resolves.toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('skips a queued web logout when a newer session is saved', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);

    const clearing = clearAccessToken();
    const saving = saveAccessToken(token);

    try {
      await expect(clearing).resolves.toBeUndefined();
      await expect(saving).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('aborts an in-flight web logout before saving a newer session', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    let logoutSignal: AbortSignal | null | undefined;
    let resolveLogout!: (response: Response) => void;
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation((input, init) => {
        if (String(input).endsWith('/auth/logout')) {
          logoutSignal = init?.signal;
          return new Promise((resolve) => {
            resolveLogout = resolve;
          });
        }
        return Promise.resolve({ ok: true } as Response);
      });

    try {
      const clearing = clearAccessToken();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(logoutSignal).toBeDefined();

      const saving = saveAccessToken(token);
      await expect(saving).resolves.toBeUndefined();
      await expect(clearing).resolves.toBeUndefined();
      expect(logoutSignal?.aborted).toBe(true);
      resolveLogout({ ok: true } as Response);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('times out a stalled web logout and releases queued saves', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    jest.useFakeTimers();
    let logoutSignal: AbortSignal | null | undefined;
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation((input, init) => {
        if (String(input).endsWith('/auth/logout')) {
          logoutSignal = init?.signal;
          return new Promise(() => undefined);
        }
        return Promise.resolve({ ok: true } as Response);
      });

    try {
      const clearing = clearAccessToken();
      const timedOut = expect(clearing).rejects.toBeInstanceOf(
        ApiRequestTimeoutError,
      );
      await Promise.resolve();
      expect(logoutSignal).toBeDefined();
      await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
      await timedOut;

      expect(logoutSignal?.aborted).toBe(true);
      await expect(saveAccessToken(token)).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
      fetchSpy.mockRestore();
    }
  });

  it('clears the query cache and propagates web logout failures', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    const logoutError = new Error('logout failed');
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(logoutError);

    try {
      await expect(clearAuthenticatedSession()).rejects.toBe(logoutError);
      expect(clearPersistedQueryCache).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not block web reads or clearing behind a stalled session probe', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });

    let resolveSessionProbe!: (response: Response) => void;
    let sessionProbeCount = 0;
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/auth/session')) {
        sessionProbeCount += 1;
        if (sessionProbeCount > 1) {
          return Promise.resolve({ ok: true } as Response);
        }
        return new Promise((resolve) => {
          resolveSessionProbe = resolve;
        });
      }
      return Promise.resolve({ ok: true } as Response);
    });

    const sessionProbe = loadAccessToken();
    const clearing = clearAccessToken();
    const laterLookup = loadAccessToken();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const logoutStartedBeforeProbeCompleted = fetchSpy.mock.calls.some(
      ([input]) => String(input).endsWith('/auth/logout'),
    );
    const laterLookupStartedBeforeProbeCompleted = sessionProbeCount === 2;

    resolveSessionProbe({ ok: true } as Response);
    await expect(sessionProbe).resolves.toBeNull();
    await expect(laterLookup).resolves.toEqual({
      accessToken: '',
      expiresAt: Number.MAX_SAFE_INTEGER,
      scope: '',
      tokenType: 'Bearer',
    });
    await clearing;

    expect(logoutStartedBeforeProbeCompleted).toBe(true);
    expect(laterLookupStartedBeforeProbeCompleted).toBe(true);
  });

  it('releases the native storage queue when a read is aborted', async () => {
    const controller = new AbortController();
    let resolveSessionRead!: (value: string | null) => void;
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSessionRead = resolve;
          }),
      );

    const lookup = loadAccessToken({ signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolveSessionRead).toBeDefined();

    controller.abort();
    await expect(lookup).rejects.toMatchObject({ name: 'AbortError' });
    await expect(clearAccessToken()).resolves.toBeUndefined();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'expo50sdktemplate.oauth.access-token',
    );

    resolveSessionRead(JSON.stringify(token));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(loadAccessToken()).resolves.toBeNull();
  });

  it('bounds a stalled native read so queued cleanup can run', async () => {
    jest.useFakeTimers();
    let resolveSessionRead!: (value: string | null) => void;
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSessionRead = resolve;
          }),
      );

    try {
      const lookup = loadAccessToken();
      const timedOut = expect(lookup).rejects.toBeInstanceOf(
        ApiRequestTimeoutError,
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(resolveSessionRead).toBeDefined();

      await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
      await timedOut;
      await expect(clearAccessToken()).resolves.toBeUndefined();

      resolveSessionRead(null);
      await Promise.resolve();
    } finally {
      jest.useRealTimers();
    }
  });

  it('repairs late refresh writes without overwriting a new sign-in', async () => {
    const originalToken = { ...token, refreshToken: 'refresh-token' };
    const refreshedToken = {
      ...originalToken,
      accessToken: 'refreshed-access-token',
    };
    const replacementToken = {
      ...originalToken,
      accessToken: 'replacement-access-token',
      refreshToken: 'replacement-refresh-token',
    };
    const accessTokenKey = 'expo50sdktemplate.oauth.access-token';
    secureStoreValues.set(
      accessTokenKey,
      JSON.stringify({ ...originalToken, storageVersion: 2 }),
    );

    const controller = new AbortController();
    let resolveLateWrite!: () => void;
    jest
      .mocked(SecureStore.setItemAsync)
      .mockImplementation(async (key, value) => {
        if (
          key === accessTokenKey &&
          value ===
            JSON.stringify({ ...refreshedToken, storageVersion: 2 })
        ) {
          await new Promise<void>((resolve) => {
            resolveLateWrite = resolve;
          });
        }
        secureStoreValues.set(key, value);
      });

    const commit = persistRefreshedAccessTokenIfCurrent(
      refreshedToken,
      originalToken,
      getAccessTokenSessionRevision(),
      controller.signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolveLateWrite).toBeDefined();

    controller.abort();
    await expect(commit).rejects.toMatchObject({ name: 'AbortError' });
    await expect(clearAccessToken()).resolves.toBeUndefined();
    expect(secureStoreValues.has(accessTokenKey)).toBe(false);

    await expect(saveAccessToken(replacementToken)).resolves.toBeUndefined();
    resolveLateWrite();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(loadAccessToken()).resolves.toEqual(replacementToken);
    expect(secureStoreValues.get(accessTokenKey)).toBe(
      JSON.stringify({ ...replacementToken, storageVersion: 2 }),
    );
  });

  it('fails when secure storage is unavailable', async () => {
    jest.mocked(SecureStore.isAvailableAsync).mockResolvedValue(false);

    await expect(loadAccessToken()).rejects.toThrow(
      'Secure storage is unavailable on this device.',
    );
    await expect(saveAccessToken(token)).rejects.toThrow(
      'Secure storage is unavailable on this device.',
    );
  });

  it('skips a paused refresh commit when the session is cleared', async () => {
    const originalToken = { ...token, refreshToken: 'refresh-token' };
    const refreshedToken = {
      ...originalToken,
      accessToken: 'refreshed-access-token',
    };
    secureStoreValues.set(
      'expo50sdktemplate.oauth.access-token',
      JSON.stringify({ ...originalToken, storageVersion: 2 }),
    );
    const expectedRevision = getAccessTokenSessionRevision();
    let resolveAvailability!: (available: boolean) => void;
    jest
      .mocked(SecureStore.isAvailableAsync)
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAvailability = resolve;
          }),
      );

    const commit = persistRefreshedAccessTokenIfCurrent(
      refreshedToken,
      originalToken,
      expectedRevision,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(SecureStore.isAvailableAsync).toHaveBeenCalledTimes(2);

    const clearing = clearAccessToken();
    resolveAvailability(true);

    await expect(commit).resolves.toBe(false);
    await clearing;
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(secureStoreValues.has('expo50sdktemplate.oauth.access-token')).toBe(
      false,
    );
  });

  it('does not overwrite a replacement session with a paused refresh commit', async () => {
    const originalToken = { ...token, refreshToken: 'refresh-token' };
    const refreshedToken = {
      ...originalToken,
      accessToken: 'refreshed-access-token',
    };
    const replacementToken = {
      ...originalToken,
      accessToken: 'replacement-access-token',
      refreshToken: 'replacement-refresh-token',
    };
    secureStoreValues.set(
      'expo50sdktemplate.oauth.access-token',
      JSON.stringify({ ...originalToken, storageVersion: 2 }),
    );
    const expectedRevision = getAccessTokenSessionRevision();
    let resolveAvailability!: (available: boolean) => void;
    jest
      .mocked(SecureStore.isAvailableAsync)
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAvailability = resolve;
          }),
      );

    const commit = persistRefreshedAccessTokenIfCurrent(
      refreshedToken,
      originalToken,
      expectedRevision,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(SecureStore.isAvailableAsync).toHaveBeenCalledTimes(2);

    const replacement = saveAccessToken(replacementToken);
    resolveAvailability(true);

    await expect(commit).resolves.toBe(false);
    await replacement;
    await expect(loadAccessToken()).resolves.toEqual(replacementToken);
  });

  it('skips refresh commits without a current token or matching session', async () => {
    const refreshedToken = {
      ...token,
      accessToken: 'refreshed-access-token',
    };
    const initialRevision = getAccessTokenSessionRevision();

    await expect(
      persistRefreshedAccessTokenIfCurrent(
        refreshedToken,
        token,
        initialRevision,
      ),
    ).resolves.toBe(false);

    await saveAccessToken(token);
    const currentRevision = getAccessTokenSessionRevision();

    await expect(
      persistRefreshedAccessTokenIfCurrent(
        refreshedToken,
        { ...token, accessToken: 'different-access-token' },
        currentRevision,
      ),
    ).resolves.toBe(false);
    await expect(
      persistRefreshedAccessTokenIfCurrent(
        refreshedToken,
        { ...token, refreshToken: 'different-refresh-token' },
        currentRevision,
      ),
    ).resolves.toBe(false);
    await expect(
      persistRefreshedAccessTokenIfCurrent(
        refreshedToken,
        token,
        currentRevision - 1,
      ),
    ).resolves.toBe(false);
  });
});
