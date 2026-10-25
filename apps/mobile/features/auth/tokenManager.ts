import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

import {
  normalizeIdentityProviderDiscovery,
  refreshAccessToken,
} from './client';
import {
  isAccessTokenExpiring,
  loadAccessToken,
  saveAccessToken,
  type StoredAccessToken,
} from './storage';

import { logInfo, logWarn } from '@/utils/logging';
import { getIdentityProviderUrl } from '@/utils/platform';

type PendingRefresh = {
  accessToken: string;
  promise: Promise<StoredAccessToken | null>;
};

let cachedDiscovery:
  | {
      issuerUrl: string;
      promise: Promise<AuthSession.DiscoveryDocument>;
    }
  | undefined;
const pendingRefreshes = new Map<string, PendingRefresh>();
let pendingWebRefresh: Promise<StoredAccessToken | null> | undefined;

function getIdentityProviderDiscovery() {
  const issuerUrl = getIdentityProviderUrl();
  if (cachedDiscovery?.issuerUrl === issuerUrl) {
    return cachedDiscovery.promise;
  }

  const promise = AuthSession.fetchDiscoveryAsync(issuerUrl).then((discovery) =>
    normalizeIdentityProviderDiscovery(discovery, issuerUrl),
  );
  const cacheEntry = { issuerUrl, promise };
  cachedDiscovery = cacheEntry;
  promise.catch(() => {
    if (cachedDiscovery === cacheEntry) cachedDiscovery = undefined;
  });
  return promise;
}

async function refreshAndPersistToken(token: StoredAccessToken) {
  logInfo('auth_access_token_refresh_started');
  try {
    const discovery = await getIdentityProviderDiscovery();
    const refreshedToken = await refreshAccessToken(token, discovery);
    const currentToken = await loadAccessToken();

    if (!currentToken) return null;
    if (
      currentToken.accessToken !== token.accessToken ||
      currentToken.refreshToken !== token.refreshToken
    ) {
      return currentToken;
    }

    await saveAccessToken(refreshedToken);
    logInfo('auth_access_token_refresh_succeeded');
    return refreshedToken;
  } catch (error) {
    logWarn('auth_access_token_refresh_failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
}

function refreshStoredToken(token: StoredAccessToken) {
  const existing = pendingRefreshes.get(token.accessToken);
  if (existing) return existing.promise;

  const promise = refreshAndPersistToken(token);
  const pending = { accessToken: token.accessToken, promise };
  pendingRefreshes.set(token.accessToken, pending);
  const clearPending = () => {
    if (pendingRefreshes.get(token.accessToken) === pending) {
      pendingRefreshes.delete(token.accessToken);
    }
  };
  promise.then(clearPending, clearPending);
  return promise;
}

function refreshWebSession(token: StoredAccessToken | null) {
  if (pendingWebRefresh) return pendingWebRefresh;

  const promise = getIdentityProviderDiscovery().then((discovery) =>
    refreshAccessToken(token ?? undefined, discovery),
  );
  pendingWebRefresh = promise;
  const clearPending = () => {
    if (pendingWebRefresh === promise) pendingWebRefresh = undefined;
  };
  promise.then(clearPending, clearPending);
  return promise;
}

export async function getValidAccessToken(
  options: {
    rejectedAccessToken?: string;
    forceRefresh?: boolean;
  } = {},
): Promise<StoredAccessToken | null> {
  const token = await loadAccessToken();
  if (Platform.OS === 'web') {
    if (!options.forceRefresh && options.rejectedAccessToken === undefined) {
      return token;
    }
    return refreshWebSession(token);
  }
  if (!token) return token;

  if (
    options.rejectedAccessToken !== undefined &&
    token.accessToken !== options.rejectedAccessToken
  ) {
    return token;
  }

  const forceRefresh =
    options.forceRefresh || token.accessToken === options.rejectedAccessToken;
  if (!forceRefresh && !isAccessTokenExpiring(token)) return token;
  if (!token.refreshToken) return token;

  return refreshStoredToken(token);
}
