import * as SecureStore from 'expo-secure-store';

import {
  clearAccessToken,
  loadAccessToken,
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

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
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
});
