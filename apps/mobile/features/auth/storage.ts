import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { clearPersistedQueryCache } from '@/state/queryClient';
import { getBackendUrl } from '@/utils/helpers';

export type StoredAccessToken = {
  accessToken: string;
  expiresAt: number;
  idToken?: string;
  refreshToken?: string;
  scope: string;
  tokenType: 'Bearer';
};

const ACCESS_TOKEN_STORAGE_KEY = 'expo50sdktemplate.oauth.access-token';
const ID_TOKEN_STORAGE_KEY = 'expo50sdktemplate.oauth.id-token';
const STORAGE_VERSION = 2;
const EXPIRY_SAFETY_WINDOW_MS = 30_000;

const webSessionToken: StoredAccessToken = {
  accessToken: '',
  expiresAt: Number.MAX_SAFE_INTEGER,
  scope: '',
  tokenType: 'Bearer',
};

function isStoredAccessToken(value: unknown): value is StoredAccessToken {
  if (!value || typeof value !== 'object') return false;

  const token = value as Partial<StoredAccessToken>;
  return (
    typeof token.accessToken === 'string' &&
    token.tokenType === 'Bearer' &&
    typeof token.scope === 'string' &&
    typeof token.expiresAt === 'number'
  );
}

function isExpired(token: StoredAccessToken) {
  return token.expiresAt <= Date.now() + EXPIRY_SAFETY_WINDOW_MS;
}

export async function loadAccessToken() {
  if (Platform.OS === 'web') {
    const response = await fetch(`${getBackendUrl()}/auth/session`, {
      credentials: 'include',
    });
    return response.ok ? webSessionToken : null;
  }

  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure storage is unavailable on this device.');
  }

  const serializedToken = await SecureStore.getItemAsync(
    ACCESS_TOKEN_STORAGE_KEY,
  );
  if (!serializedToken) return null;

  try {
    const parsedToken: unknown = JSON.parse(serializedToken);
    if (!isStoredAccessToken(parsedToken)) {
      await clearAccessToken();
      return null;
    }
    if (isExpired(parsedToken) && !parsedToken.refreshToken) {
      await clearAccessToken();
      return null;
    }
    if (
      'storageVersion' in parsedToken &&
      parsedToken.storageVersion === STORAGE_VERSION
    ) {
      const idToken = await SecureStore.getItemAsync(ID_TOKEN_STORAGE_KEY);
      const { storageVersion: _storageVersion, ...storedToken } = parsedToken;
      return idToken ? { ...storedToken, idToken } : storedToken;
    }
    return parsedToken;
  } catch {
    await clearAccessToken();
    return null;
  }
}

export async function saveAccessToken(token: StoredAccessToken) {
  if (Platform.OS === 'web') {
    return;
  }

  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure storage is unavailable on this device.');
  }

  const { idToken, ...tokenWithoutIdToken } = token;
  await SecureStore.setItemAsync(
    ACCESS_TOKEN_STORAGE_KEY,
    JSON.stringify({ ...tokenWithoutIdToken, storageVersion: STORAGE_VERSION }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
  if (idToken) {
    await SecureStore.setItemAsync(ID_TOKEN_STORAGE_KEY, idToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(ID_TOKEN_STORAGE_KEY);
  }
}

export async function clearAccessToken() {
  if (Platform.OS === 'web') {
    await fetch(`${getBackendUrl()}/auth/logout`, {
      credentials: 'include',
      method: 'POST',
    });
    return;
  }

  await SecureStore.deleteItemAsync(ACCESS_TOKEN_STORAGE_KEY);
  await SecureStore.deleteItemAsync(ID_TOKEN_STORAGE_KEY);
}

export async function clearAuthenticatedSession() {
  await clearAccessToken();
  await clearPersistedQueryCache();
}
