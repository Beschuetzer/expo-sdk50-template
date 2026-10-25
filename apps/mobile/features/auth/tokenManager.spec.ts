import type { DiscoveryDocument } from 'expo-auth-session';
import { Platform } from 'react-native';

import {
  fetchIdentityProviderDiscovery,
  normalizeIdentityProviderDiscovery,
  refreshAccessToken,
} from './client';
import {
  getAccessTokenSessionRevision,
  loadAccessToken,
  persistRefreshedAccessTokenIfCurrent,
  type StoredAccessToken,
} from './storage';
import { getValidAccessToken } from './tokenManager';

import { getIdentityProviderUrl } from '@/utils/platform';

jest.mock('./client', () => ({
  fetchIdentityProviderDiscovery: jest.fn(),
  normalizeIdentityProviderDiscovery: jest.fn((discovery) => discovery),
  refreshAccessToken: jest.fn(),
}));

jest.mock('./storage', () => ({
  isAccessTokenExpiring: jest.fn(
    (token: { expiresAt: number }) => token.expiresAt <= Date.now() + 30_000,
  ),
  getAccessTokenSessionRevision: jest.fn(),
  loadAccessToken: jest.fn(),
  persistRefreshedAccessTokenIfCurrent: jest.fn(),
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

  it('refreshes a token near expiry and persists the replacement', async () => {
    const expiredSoon = makeToken({ expiresAt: Date.now() + 10_000 });
    const refreshed = makeToken({
      accessToken: 'refreshed-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    storedToken = expiredSoon;
    jest.mocked(refreshAccessToken).mockResolvedValue(refreshed);

    await expect(getValidAccessToken()).resolves.toEqual(refreshed);

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
});
