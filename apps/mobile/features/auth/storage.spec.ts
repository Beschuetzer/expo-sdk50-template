import * as SecureStore from 'expo-secure-store';

import {
  clearAccessToken,
  getAccessTokenSessionRevision,
  loadAccessToken,
  persistRefreshedAccessTokenIfCurrent,
  saveAccessToken,
  type StoredAccessToken,
} from './storage';

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
});
