import type { DiscoveryDocument } from 'expo-auth-session';
import { Platform } from 'react-native';

import { awaitWithAbort, throwIfAborted } from './abort';
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
  isAccessTokenExpiring,
  loadAccessToken,
  persistRefreshedAccessTokenIfCurrent,
  type StoredAccessToken,
} from './storage';

import { logInfo, logWarn } from '@/utils/logging';
import { getIdentityProviderUrl } from '@/utils/platform';

type RefreshState = {
  deadlineExpired: boolean;
  tokenExchangeCompleted: boolean;
  tokenExchangeStarted: boolean;
};

type PendingRefresh = {
  controller: AbortController;
  refreshState: RefreshState;
  sessionRevision: number;
  promise: Promise<StoredAccessToken | null>;
  settled: boolean;
  waiters: number;
};

type PendingWebRefresh = PendingRefresh;

const refreshOutcomeUnknownListeners = new Set<() => void>();

export class MissingRefreshTokenError extends Error {
  constructor() {
    super();
    this.name = 'MissingRefreshTokenError';
  }
}

let cachedDiscovery:
  | { issuerUrl: string; discovery: DiscoveryDocument }
  | undefined;
const pendingRefreshes = new Map<string, PendingRefresh>();
let pendingWebRefresh: PendingWebRefresh | undefined;

export function subscribeToRefreshOutcomeUnknown(listener: () => void) {
  refreshOutcomeUnknownListeners.add(listener);
  return () => {
    refreshOutcomeUnknownListeners.delete(listener);
  };
}

function notifyRefreshOutcomeUnknown() {
  for (const listener of refreshOutcomeUnknownListeners) {
    try {
      listener();
    } catch (error) {
      logWarn('auth_refresh_outcome_listener_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }
}

function createRefreshState(): RefreshState {
  return {
    deadlineExpired: false,
    tokenExchangeCompleted: false,
    tokenExchangeStarted: false,
  };
}

function startRefreshDeadline(
  controller: AbortController,
  refreshState: RefreshState,
) {
  let stopped = false;
  const timeoutId = setTimeout(() => {
    refreshState.deadlineExpired = true;
    controller.abort();
  }, AUTH_REQUEST_TIMEOUT_MS);

  return () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timeoutId);
  };
}

function clearSessionAfterUncertainRefresh(sessionRevision: number): boolean {
  if (getAccessTokenSessionRevision() !== sessionRevision) return false;

  const clearRequest = clearAuthenticatedSession();
  const clearedSessionRevision = getAccessTokenSessionRevision();
  clearRequest
    .then(() => {
      if (getAccessTokenSessionRevision() === clearedSessionRevision) {
        notifyRefreshOutcomeUnknown();
      }
    })
    .catch((error: unknown) => {
      logWarn('auth_access_token_session_clear_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    });
  return true;
}

function recoverRefreshFailure(
  error: unknown,
  refreshState: RefreshState,
  sessionRevision: number,
): unknown {
  const isDefinitiveOAuthRejection =
    refreshState.tokenExchangeStarted &&
    !refreshState.tokenExchangeCompleted &&
    error instanceof DefinitiveOAuthRejectionError;
  if (isDefinitiveOAuthRejection) return error;

  const sessionIsCurrent = getAccessTokenSessionRevision() === sessionRevision;
  if (refreshState.deadlineExpired) {
    if (refreshState.tokenExchangeStarted && sessionIsCurrent) {
      clearSessionAfterUncertainRefresh(sessionRevision);
      return new RefreshOutcomeUnknownError();
    }
    return new ApiRequestTimeoutError();
  }

  if (refreshState.tokenExchangeStarted && sessionIsCurrent) {
    clearSessionAfterUncertainRefresh(sessionRevision);
    return new RefreshOutcomeUnknownError();
  }
  return error;
}

function loadAccessTokenForRequest(signal?: AbortSignal) {
  return signal ? loadAccessToken({ signal }) : loadAccessToken();
}

function waitForPendingRefresh(pending: PendingRefresh, signal?: AbortSignal) {
  pending.waiters += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    pending.waiters -= 1;
    if (
      pending.waiters === 0 &&
      !pending.settled &&
      !pending.refreshState.tokenExchangeStarted
    ) {
      pending.controller.abort();
    }
  };

  return awaitWithAbort(pending.promise, signal).finally(release);
}

function getIdentityProviderDiscovery(signal?: AbortSignal) {
  throwIfAborted(signal);
  const issuerUrl = getIdentityProviderUrl();
  if (cachedDiscovery?.issuerUrl === issuerUrl) {
    return Promise.resolve(cachedDiscovery.discovery);
  }

  const discoveryRequest = signal
    ? fetchIdentityProviderDiscovery(issuerUrl, signal)
    : fetchIdentityProviderDiscovery(issuerUrl);
  return awaitWithAbort(discoveryRequest, signal).then((result) => {
    throwIfAborted(signal);
    const discovery = normalizeIdentityProviderDiscovery(result, issuerUrl);
    cachedDiscovery = { issuerUrl, discovery };
    return discovery;
  });
}

async function refreshAndPersistToken(
  token: StoredAccessToken,
  sessionRevision: number,
  refreshState: RefreshState,
  stopDeadline: () => void,
  signal?: AbortSignal,
) {
  logInfo('auth_access_token_refresh_started');
  try {
    const discovery = await getIdentityProviderDiscovery(signal);
    throwIfAborted(signal);
    if (!discovery.tokenEndpoint) {
      throw new MissingTokenEndpointError();
    }
    refreshState.tokenExchangeStarted = true;
    const refreshRequest = signal
      ? refreshAccessToken(token, discovery, signal)
      : refreshAccessToken(token, discovery);
    const refreshedToken = await awaitWithAbort(refreshRequest, signal);
    throwIfAborted(signal);
    refreshState.tokenExchangeCompleted = true;
    const persistRequest = signal
      ? persistRefreshedAccessTokenIfCurrent(
          refreshedToken,
          token,
          sessionRevision,
          signal,
        )
      : persistRefreshedAccessTokenIfCurrent(
          refreshedToken,
          token,
          sessionRevision,
        );
    const persisted = await awaitWithAbort(persistRequest, signal);
    if (!persisted || getAccessTokenSessionRevision() !== sessionRevision) {
      return await awaitWithAbort(loadAccessTokenForRequest(signal), signal);
    }
    logInfo('auth_access_token_refresh_succeeded');
    return refreshedToken;
  } catch (error) {
    const recoveredError = recoverRefreshFailure(
      error,
      refreshState,
      sessionRevision,
    );
    logWarn('auth_access_token_refresh_failed', {
      errorName:
        recoveredError instanceof Error ? recoveredError.name : 'UnknownError',
    });
    throw recoveredError;
  } finally {
    stopDeadline();
  }
}

function refreshStoredToken(
  token: StoredAccessToken,
  sessionRevision: number,
  signal?: AbortSignal,
) {
  const existing = pendingRefreshes.get(token.accessToken);
  if (
    existing?.sessionRevision === sessionRevision &&
    !existing.controller.signal.aborted
  ) {
    return waitForPendingRefresh(existing, signal);
  }

  const controller = new AbortController();
  const refreshState = createRefreshState();
  const stopDeadline = startRefreshDeadline(controller, refreshState);
  const promise = refreshAndPersistToken(
    token,
    sessionRevision,
    refreshState,
    stopDeadline,
    controller.signal,
  );
  const pending = {
    controller,
    refreshState,
    sessionRevision,
    promise,
    settled: false,
    waiters: 0,
  };
  pendingRefreshes.set(token.accessToken, pending);
  const clearPending = () => {
    pending.settled = true;
    if (pendingRefreshes.get(token.accessToken) === pending) {
      pendingRefreshes.delete(token.accessToken);
    }
  };
  promise.then(clearPending, clearPending);
  return waitForPendingRefresh(pending, signal);
}

function refreshWebSession(
  token: StoredAccessToken | null,
  sessionRevision: number,
  signal?: AbortSignal,
) {
  if (
    pendingWebRefresh?.sessionRevision === sessionRevision &&
    !pendingWebRefresh.controller.signal.aborted
  ) {
    return waitForPendingRefresh(pendingWebRefresh, signal);
  }

  const controller = new AbortController();
  const refreshState = createRefreshState();
  const stopDeadline = startRefreshDeadline(controller, refreshState);
  const promise = (async () => {
    try {
      const discovery = await getIdentityProviderDiscovery(controller.signal);
      throwIfAborted(controller.signal);
      refreshState.tokenExchangeStarted = true;
      const refreshedToken = await awaitWithAbort(
        refreshAccessToken(token ?? undefined, discovery, controller.signal),
        controller.signal,
      );
      throwIfAborted(controller.signal);
      refreshState.tokenExchangeCompleted = true;
      if (getAccessTokenSessionRevision() !== sessionRevision) {
        return await awaitWithAbort(
          loadAccessTokenForRequest(controller.signal),
          controller.signal,
        );
      }
      return refreshedToken;
    } catch (error) {
      const recoveredError = recoverRefreshFailure(
        error,
        refreshState,
        sessionRevision,
      );
      logWarn('auth_access_token_refresh_failed', {
        errorName:
          recoveredError instanceof Error
            ? recoveredError.name
            : 'UnknownError',
      });
      throw recoveredError;
    } finally {
      stopDeadline();
    }
  })();
  const pending = {
    controller,
    refreshState,
    sessionRevision,
    promise,
    settled: false,
    waiters: 0,
  };
  pendingWebRefresh = pending;
  const clearPending = () => {
    pending.settled = true;
    if (pendingWebRefresh === pending) pendingWebRefresh = undefined;
  };
  promise.then(clearPending, clearPending);
  return waitForPendingRefresh(pending, signal);
}

export async function getValidAccessToken(
  options: {
    rejectedAccessToken?: string;
    forceRefresh?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<StoredAccessToken | null> {
  const { signal } = options;
  throwIfAborted(signal);
  const sessionRevision = getAccessTokenSessionRevision();
  const loadRequest = loadAccessTokenForRequest(signal);
  const token = await awaitWithAbort(loadRequest, signal);
  throwIfAborted(signal);
  if (Platform.OS === 'web') {
    if (!options.forceRefresh && options.rejectedAccessToken === undefined) {
      return token;
    }
    return refreshWebSession(token, sessionRevision, signal);
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
  if (!token.refreshToken) {
    if (options.forceRefresh) {
      throw new MissingRefreshTokenError();
    }
    return token;
  }

  return refreshStoredToken(token, sessionRevision, signal);
}
