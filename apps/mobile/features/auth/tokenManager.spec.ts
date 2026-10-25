import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

import {
  normalizeIdentityProviderDiscovery,
  refreshAccessToken,
} from './client';
import {
  loadAccessToken,
  saveAccessToken,
  type StoredAccessToken,
} from './storage';
import { getValidAccessToken } from './tokenManager';

import { getIdentityProviderUrl } from '@/utils/platform';

jest.mock('expo-auth-session', () => ({
  fetchDiscoveryAsync: jest.fn(),
}));

jest.mock('./client', () => ({
  normalizeIdentityProviderDiscovery: jest.fn((discovery) => discovery),
  refreshAccessToken: jest.fn(),
}));

jest.mock('./storage', () => ({
  isAccessTokenExpiring: jest.fn(
    (token: { expiresAt: number }) => token.expiresAt <= Date.now() + 30_000,
  ),
  loadAccessToken: jest.fn(),
  saveAccessToken: jest.fn(),
}));

jest.mock('@/utils/platform', () => ({
  getIdentityProviderUrl: jest.fn(),
}));

describe('access-token manager', () => {
  let storedToken: StoredAccessToken | null;

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
    jest.mocked(loadAccessToken).mockImplementation(async () => storedToken);
    jest.mocked(saveAccessToken).mockImplementation(async (token) => {
      storedToken = token;
    });
    jest.mocked(AuthSession.fetchDiscoveryAsync).mockResolvedValue({
      tokenEndpoint: 'https://identity.example.com/token',
    } as AuthSession.DiscoveryDocument);
    jest
      .mocked(getIdentityProviderUrl)
      .mockReturnValue(`https://identity.example.com/${Date.now()}`);
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

    expect(refreshAccessToken).toHaveBeenCalledWith(
      expiredSoon,
      expect.objectContaining({
        tokenEndpoint: 'https://identity.example.com/token',
      }),
    );
    expect(saveAccessToken).toHaveBeenCalledWith(refreshed);
    expect(storedToken).toEqual(refreshed);
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
    resolveRefresh(refreshed);

    await expect(pendingRequest).resolves.toBeNull();
    expect(saveAccessToken).not.toHaveBeenCalled();
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
    expect(refreshAccessToken).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        tokenEndpoint: 'https://identity.example.com/token',
      }),
    );
    expect(saveAccessToken).not.toHaveBeenCalled();
  });
});
