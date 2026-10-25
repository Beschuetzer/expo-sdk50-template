import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { awaitWithAbort, throwIfAborted } from './abort';
import { ApiRequestTimeoutError, AUTH_REQUEST_TIMEOUT_MS } from './errors';

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

let tokenSessionRevision = 0;
let tokenStorageQueue: Promise<void> = Promise.resolve();
let pendingWebLogout: { controller: AbortController } | undefined;

function serializeAccessTokenOperation<T>(operation: () => Promise<T>) {
  const result = tokenStorageQueue.then(operation, operation);
  tokenStorageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function advanceTokenSessionRevision() {
  tokenSessionRevision += 1;
  pendingWebLogout?.controller.abort();
  return tokenSessionRevision;
}

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

export function isAccessTokenExpiring(token: StoredAccessToken) {
  return token.expiresAt <= Date.now() + EXPIRY_SAFETY_WINDOW_MS;
}

async function loadAccessTokenUnlocked(signal?: AbortSignal) {
  throwIfAborted(signal);
  if (Platform.OS === 'web') {
    const response = await fetch(`${getBackendUrl()}/auth/session`, {
      credentials: 'include',
      ...(signal ? { signal } : {}),
    });
    throwIfAborted(signal);
    return response.ok ? webSessionToken : null;
  }

  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure storage is unavailable on this device.');
  }
  throwIfAborted(signal);

  const serializedToken = await SecureStore.getItemAsync(
    ACCESS_TOKEN_STORAGE_KEY,
  );
  throwIfAborted(signal);
  if (!serializedToken) return null;

  try {
    const parsedToken: unknown = JSON.parse(serializedToken);
    if (!isStoredAccessToken(parsedToken)) {
      advanceTokenSessionRevision();
      await clearAccessTokenUnlocked();
      return null;
    }
    if (isAccessTokenExpiring(parsedToken) && !parsedToken.refreshToken) {
      advanceTokenSessionRevision();
      await clearAccessTokenUnlocked();
      return null;
    }
    if (
      'storageVersion' in parsedToken &&
      parsedToken.storageVersion === STORAGE_VERSION
    ) {
      const idToken = await SecureStore.getItemAsync(ID_TOKEN_STORAGE_KEY);
      throwIfAborted(signal);
      const { storageVersion: _storageVersion, ...storedToken } = parsedToken;
      return idToken ? { ...storedToken, idToken } : storedToken;
    }
    return parsedToken;
  } catch {
    if (signal?.aborted) throwIfAborted(signal);
    advanceTokenSessionRevision();
    await clearAccessTokenUnlocked();
    return null;
  }
}

async function saveAccessTokenUnlocked(
  token: StoredAccessToken,
  isCurrent: () => boolean = () => true,
  signal?: AbortSignal,
) {
  if (Platform.OS === 'web') {
    return isCurrent();
  }

  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure storage is unavailable on this device.');
  }
  if (!isCurrent() || signal?.aborted) return false;

  const { idToken, ...tokenWithoutIdToken } = token;
  await SecureStore.setItemAsync(
    ACCESS_TOKEN_STORAGE_KEY,
    JSON.stringify({ ...tokenWithoutIdToken, storageVersion: STORAGE_VERSION }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
  if (!isCurrent()) return false;
  if (idToken) {
    await SecureStore.setItemAsync(ID_TOKEN_STORAGE_KEY, idToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(ID_TOKEN_STORAGE_KEY);
  }
  return isCurrent();
}

async function clearAccessTokenUnlocked(isCurrent: () => boolean = () => true) {
  if (Platform.OS === 'web') {
    if (!isCurrent()) return;

    const pendingLogout = { controller: new AbortController() };
    pendingWebLogout = pendingLogout;
    const timeoutId = setTimeout(
      () => pendingLogout.controller.abort(),
      AUTH_REQUEST_TIMEOUT_MS,
    );
    try {
      await awaitWithAbort(
        fetch(`${getBackendUrl()}/auth/logout`, {
          credentials: 'include',
          method: 'POST',
          signal: pendingLogout.controller.signal,
        }),
        pendingLogout.controller.signal,
      );
    } catch (error) {
      if (!isCurrent()) return;
      if (pendingLogout.controller.signal.aborted) {
        throw new ApiRequestTimeoutError();
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (pendingWebLogout === pendingLogout) {
        pendingWebLogout = undefined;
      }
    }
    return;
  }

  await SecureStore.deleteItemAsync(ACCESS_TOKEN_STORAGE_KEY);
  await SecureStore.deleteItemAsync(ID_TOKEN_STORAGE_KEY);
}

export function getAccessTokenSessionRevision() {
  return tokenSessionRevision;
}

export function loadAccessToken(options: { signal?: AbortSignal } = {}) {
  const requestedRevision = tokenSessionRevision;
  const load = async () => {
    throwIfAborted(options.signal);
    const token = await loadAccessTokenUnlocked(options.signal);
    return requestedRevision === tokenSessionRevision ? token : null;
  };

  return Platform.OS === 'web' ? load() : serializeAccessTokenOperation(load);
}

export function saveAccessToken(token: StoredAccessToken) {
  advanceTokenSessionRevision();
  return serializeAccessTokenOperation(async () => {
    await saveAccessTokenUnlocked(token);
  });
}

export function persistRefreshedAccessTokenIfCurrent(
  refreshedToken: StoredAccessToken,
  originalToken: StoredAccessToken,
  expectedRevision: number,
  signal?: AbortSignal,
): Promise<boolean> {
  return serializeAccessTokenOperation(async () => {
    throwIfAborted(signal);
    const currentToken = await loadAccessTokenUnlocked(signal);
    if (!currentToken) return false;
    if (
      currentToken.accessToken !== originalToken.accessToken ||
      currentToken.refreshToken !== originalToken.refreshToken
    ) {
      return false;
    }
    if (tokenSessionRevision !== expectedRevision || signal?.aborted) {
      return false;
    }

    return saveAccessTokenUnlocked(
      refreshedToken,
      () => tokenSessionRevision === expectedRevision,
      signal,
    );
  });
}

export function clearAccessToken() {
  const revision = advanceTokenSessionRevision();
  return serializeAccessTokenOperation(async () => {
    await clearAccessTokenUnlocked(() => revision === tokenSessionRevision);
  });
}

export async function clearAuthenticatedSession() {
  try {
    await clearAccessToken();
  } finally {
    await clearPersistedQueryCache();
  }
}
