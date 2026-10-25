import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { awaitWithAbort, throwIfAborted } from './abort';
import { ApiRequestTimeoutError, AUTH_REQUEST_TIMEOUT_MS } from './errors';
import { beginWebSessionLogout } from './webSession';

import { clearPersistedQueryCache } from '@/state/queryClient';
import { getBackendUrl } from '@/utils/helpers';
import { logWarn } from '@/utils/logging';

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
type TokenStorageIntent = {
  revision: number;
  token: StoredAccessToken | null;
};
let tokenStorageIntent: TokenStorageIntent | undefined;
let completedTokenStorageIntent: TokenStorageIntent | undefined;
let pendingNativeStorageWrites = 0;
let tokenStorageRepairScheduled = false;
let tokenStorageRepairNeeded = false;
let pendingWebLogout: { controller: AbortController } | undefined;

async function runSerializedAccessTokenOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AUTH_REQUEST_TIMEOUT_MS);
  const abortOperation = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', abortOperation, { once: true });
  }

  try {
    throwIfAborted(signal);
    let operationPromise: Promise<T>;
    try {
      throwIfAborted(controller.signal);
      operationPromise = operation(controller.signal);
    } catch (error) {
      operationPromise = Promise.reject(error);
    }
    return await awaitWithAbort(operationPromise, controller.signal);
  } catch (error) {
    if (timedOut) throw new ApiRequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortOperation);
  }
}

function serializeAccessTokenOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) {
  const run = () => runSerializedAccessTokenOperation(operation, signal);
  const result = tokenStorageQueue.then(run, run);
  tokenStorageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return signal ? awaitWithAbort(result, signal) : result;
}

function setTokenStorageIntent(
  revision: number,
  token: StoredAccessToken | null,
) {
  if (Platform.OS === 'web') return undefined;

  const intent = { revision, token };
  tokenStorageIntent = intent;
  completedTokenStorageIntent = undefined;
  return intent;
}

function isCurrentTokenStorageIntent(
  intent: TokenStorageIntent | undefined,
) {
  return !intent || tokenStorageIntent === intent;
}

function completeTokenStorageIntent(intent: TokenStorageIntent | undefined) {
  if (!intent || tokenStorageIntent !== intent) return;

  completedTokenStorageIntent = intent;
  if (
    pendingNativeStorageWrites === 0 &&
    !tokenStorageRepairScheduled &&
    !tokenStorageRepairNeeded
  ) {
    tokenStorageIntent = undefined;
    completedTokenStorageIntent = undefined;
  }
}

function clearCompletedTokenStorageIntent() {
  if (
    tokenStorageIntent &&
    tokenStorageIntent === completedTokenStorageIntent &&
    pendingNativeStorageWrites === 0 &&
    !tokenStorageRepairScheduled &&
    !tokenStorageRepairNeeded
  ) {
    tokenStorageIntent = undefined;
    completedTokenStorageIntent = undefined;
  }
}

function areStoredTokensEqual(
  first: StoredAccessToken | null,
  second: StoredAccessToken | null,
) {
  if (first === null || second === null) return first === second;

  return (
    first.accessToken === second.accessToken &&
    first.expiresAt === second.expiresAt &&
    first.idToken === second.idToken &&
    first.refreshToken === second.refreshToken &&
    first.scope === second.scope &&
    first.tokenType === second.tokenType
  );
}

function requestTokenStorageRepair() {
  if (Platform.OS === 'web' || !tokenStorageIntent) return;

  tokenStorageRepairNeeded = true;
  if (tokenStorageRepairScheduled) return;

  tokenStorageRepairScheduled = true;
  const repair = serializeAccessTokenOperation(async (signal) => {
    tokenStorageRepairNeeded = false;
    const intent = tokenStorageIntent;
    if (!intent) return;

    const isCurrent = () =>
      tokenSessionRevision === intent.revision &&
      tokenStorageIntent === intent;
    if (!isCurrent()) {
      tokenStorageRepairNeeded = true;
      return;
    }

    const requestRepairIfSuperseded = () => {
      if (!isCurrent()) requestTokenStorageRepair();
    };
    if (intent.token) {
      const repaired = await saveAccessTokenUnlocked(
        intent.token,
        isCurrent,
        signal,
        requestRepairIfSuperseded,
      );
      if (repaired && isCurrent()) completeTokenStorageIntent(intent);
    } else {
      await clearAccessTokenUnlocked(
        isCurrent,
        signal,
        requestRepairIfSuperseded,
      );
      if (isCurrent() && !signal.aborted) {
        completeTokenStorageIntent(intent);
      }
    }
  });
  const finishRepair = () => {
    tokenStorageRepairScheduled = false;
    if (tokenStorageRepairNeeded) requestTokenStorageRepair();
    else clearCompletedTokenStorageIntent();
  };

  repair.then(finishRepair, (error: unknown) => {
    logWarn('auth_access_token_storage_repair_failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    finishRepair();
  });
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
      const revision = advanceTokenSessionRevision();
      const intent = setTokenStorageIntent(revision, null);
      await clearAccessTokenUnlocked(
        () =>
          revision === tokenSessionRevision &&
          isCurrentTokenStorageIntent(intent),
        signal,
      );
      if (
        revision === tokenSessionRevision &&
        isCurrentTokenStorageIntent(intent) &&
        !signal?.aborted
      ) {
        completeTokenStorageIntent(intent);
      }
      return null;
    }
    if (isAccessTokenExpiring(parsedToken) && !parsedToken.refreshToken) {
      const revision = advanceTokenSessionRevision();
      const intent = setTokenStorageIntent(revision, null);
      await clearAccessTokenUnlocked(
        () =>
          revision === tokenSessionRevision &&
          isCurrentTokenStorageIntent(intent),
        signal,
      );
      if (
        revision === tokenSessionRevision &&
        isCurrentTokenStorageIntent(intent) &&
        !signal?.aborted
      ) {
        completeTokenStorageIntent(intent);
      }
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
    const revision = advanceTokenSessionRevision();
    const intent = setTokenStorageIntent(revision, null);
    await clearAccessTokenUnlocked(
      () =>
        revision === tokenSessionRevision &&
        isCurrentTokenStorageIntent(intent),
      signal,
    );
    if (
      revision === tokenSessionRevision &&
      isCurrentTokenStorageIntent(intent) &&
      !signal?.aborted
    ) {
      completeTokenStorageIntent(intent);
    }
    return null;
  }
}

async function completeStorageWrite(
  write: Promise<void>,
  isCurrent: () => boolean,
  signal: AbortSignal | undefined,
  onStaleWrite: () => void,
) {
  pendingNativeStorageWrites += 1;
  try {
    await write;
  } catch (error) {
    if (!isCurrent() || signal?.aborted) onStaleWrite();
    pendingNativeStorageWrites -= 1;
    clearCompletedTokenStorageIntent();
    throw error;
  }

  const isValid = isCurrent() && !signal?.aborted;
  if (!isValid) onStaleWrite();
  pendingNativeStorageWrites -= 1;
  clearCompletedTokenStorageIntent();
  return isValid;
}

async function saveAccessTokenUnlocked(
  token: StoredAccessToken,
  isCurrent: () => boolean = () => true,
  signal?: AbortSignal,
  onStaleWrite: () => void = requestTokenStorageRepair,
) {
  if (Platform.OS === 'web') {
    return isCurrent() && !signal?.aborted;
  }

  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure storage is unavailable on this device.');
  }
  if (!isCurrent() || signal?.aborted) return false;

  const { idToken, ...tokenWithoutIdToken } = token;
  const accessTokenWritten = await completeStorageWrite(
    SecureStore.setItemAsync(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify({
        ...tokenWithoutIdToken,
        storageVersion: STORAGE_VERSION,
      }),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    ),
    isCurrent,
    signal,
    onStaleWrite,
  );
  if (!accessTokenWritten) return false;

  if (idToken) {
    const idTokenWritten = await completeStorageWrite(
      SecureStore.setItemAsync(ID_TOKEN_STORAGE_KEY, idToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
      isCurrent,
      signal,
      onStaleWrite,
    );
    if (!idTokenWritten) return false;
  } else {
    const idTokenDeleted = await completeStorageWrite(
      SecureStore.deleteItemAsync(ID_TOKEN_STORAGE_KEY),
      isCurrent,
      signal,
      onStaleWrite,
    );
    if (!idTokenDeleted) return false;
  }
  return isCurrent() && !signal?.aborted;
}

async function clearAccessTokenUnlocked(
  isCurrent: () => boolean = () => true,
  signal?: AbortSignal,
  onStaleWrite: () => void = requestTokenStorageRepair,
) {
  if (Platform.OS === 'web') {
    if (!isCurrent() || signal?.aborted) return;

    const pendingLogout = { controller: new AbortController() };
    pendingWebLogout = pendingLogout;
    const abortLogout = () => pendingLogout.controller.abort();
    signal?.addEventListener('abort', abortLogout, { once: true });
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
      signal?.removeEventListener('abort', abortLogout);
      if (pendingWebLogout === pendingLogout) {
        pendingWebLogout = undefined;
      }
    }
    return;
  }

  if (!isCurrent() || signal?.aborted) return;

  const accessTokenDeleted = await completeStorageWrite(
    SecureStore.deleteItemAsync(ACCESS_TOKEN_STORAGE_KEY),
    isCurrent,
    signal,
    onStaleWrite,
  );
  if (!accessTokenDeleted) return;

  await completeStorageWrite(
    SecureStore.deleteItemAsync(ID_TOKEN_STORAGE_KEY),
    isCurrent,
    signal,
    onStaleWrite,
  );
}

export function getAccessTokenSessionRevision() {
  return tokenSessionRevision;
}

function resolveTokenStorageIntent(
  token: StoredAccessToken | null,
  revision: number,
) {
  if (Platform.OS === 'web') return token;

  const intent = tokenStorageIntent;
  if (intent?.revision === revision) {
    if (!areStoredTokensEqual(intent.token, token)) {
      requestTokenStorageRepair();
    }
    return intent.token;
  }

  return token;
}

export function loadAccessToken(options: { signal?: AbortSignal } = {}) {
  const requestedRevision = tokenSessionRevision;
  const load = async (signal?: AbortSignal) => {
    throwIfAborted(signal);
    const token = await loadAccessTokenUnlocked(signal);
    if (requestedRevision !== tokenSessionRevision) return null;
    return resolveTokenStorageIntent(token, requestedRevision);
  };

  return Platform.OS === 'web'
    ? load(options.signal)
    : serializeAccessTokenOperation(load, options.signal);
}

export function saveAccessToken(token: StoredAccessToken) {
  const revision = advanceTokenSessionRevision();
  const intent = setTokenStorageIntent(revision, token);
  const isCurrent = () =>
    revision === tokenSessionRevision &&
    isCurrentTokenStorageIntent(intent);

  return serializeAccessTokenOperation(async (signal) => {
    const saved = await saveAccessTokenUnlocked(token, isCurrent, signal);
    if (saved && isCurrent()) completeTokenStorageIntent(intent);
  }).catch((error: unknown) => {
    if (isCurrent() && Platform.OS !== 'web') {
      setTokenStorageIntent(revision, null);
      requestTokenStorageRepair();
    }
    throw error;
  });
}

export function persistRefreshedAccessTokenIfCurrent(
  refreshedToken: StoredAccessToken,
  originalToken: StoredAccessToken,
  expectedRevision: number,
  signal?: AbortSignal,
): Promise<boolean> {
  return serializeAccessTokenOperation(async (operationSignal) => {
    throwIfAborted(operationSignal);
    const currentToken = await loadAccessTokenUnlocked(operationSignal);
    if (!currentToken) return false;
    if (
      currentToken.accessToken !== originalToken.accessToken ||
      currentToken.refreshToken !== originalToken.refreshToken
    ) {
      return false;
    }
    if (
      tokenSessionRevision !== expectedRevision ||
      operationSignal.aborted
    ) {
      return false;
    }

    const intent = setTokenStorageIntent(expectedRevision, currentToken);
    const isCurrent = () =>
      tokenSessionRevision === expectedRevision &&
      isCurrentTokenStorageIntent(intent);
    const persisted = await saveAccessTokenUnlocked(
      refreshedToken,
      isCurrent,
      operationSignal,
    );

    if (persisted && !operationSignal.aborted && isCurrent()) {
      const savedIntent = setTokenStorageIntent(
        expectedRevision,
        refreshedToken,
      );
      completeTokenStorageIntent(savedIntent);
    }
    return persisted;
  }, signal);
}

export function clearAccessToken() {
  const revision = advanceTokenSessionRevision();
  const intent = setTokenStorageIntent(revision, null);
  const webSessionLogout =
    Platform.OS === 'web' ? beginWebSessionLogout() : undefined;
  const isCurrent = () =>
    revision === tokenSessionRevision &&
    isCurrentTokenStorageIntent(intent);

  const clearRequest = serializeAccessTokenOperation(async (signal) => {
    if (!isCurrent() || signal.aborted) return;
    await webSessionLogout?.waitForPendingRefreshes(signal);
    if (!isCurrent() || signal.aborted) return;
    await clearAccessTokenUnlocked(isCurrent, signal);
    if (isCurrent() && !signal.aborted) completeTokenStorageIntent(intent);
  });
  return clearRequest.finally(() => webSessionLogout?.release());
}

export async function clearAuthenticatedSession() {
  try {
    await clearAccessToken();
  } finally {
    await clearPersistedQueryCache();
  }
}
