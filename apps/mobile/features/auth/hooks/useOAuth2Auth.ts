import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  getAuthenticatedUser,
  type AuthenticatedUser,
} from '../authenticatedUser';
import {
  createProviderLogoutUrl,
  exchangeAuthorizationCodeForCurrentPlatform,
  MOBILE_OAUTH_AUDIENCE,
  MOBILE_OAUTH_CLIENT_ID,
  MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI,
  MOBILE_OAUTH_SCHEME,
  MOBILE_OAUTH_SCOPES,
  revokeRefreshToken,
  normalizeIdentityProviderDiscovery,
} from '../client';
import {
  clearAuthenticatedSession,
  loadAccessToken,
  saveAccessToken,
  type StoredAccessToken,
} from '../storage';
import { getValidAccessToken } from '../tokenManager';

import { logDebug, logError, logInfo, logWarn } from '@/utils/logging';
import { getIdentityProviderUrl } from '@/utils/platform';

WebBrowser.maybeCompleteAuthSession();

export type OAuth2AuthState =
  | 'idle'
  | 'authenticating'
  | 'loading'
  | 'success'
  | 'cancelled'
  | 'error';

const AUTH_REQUEST_PREPARATION_TIMEOUT_MS = 15_000;

export function useOAuth2AuthState() {
  if (!MOBILE_OAUTH_CLIENT_ID) {
    throw new Error(
      'EXPO_PUBLIC_OAUTH_CLIENT_ID must be set from AUTH_CLIENT_ID.',
    );
  }

  const issuerUrl = getIdentityProviderUrl();
  const [discoveryAttempt, setDiscoveryAttempt] = useState(0);
  const [providerDiscovery, setProviderDiscovery] =
    useState<AuthSession.DiscoveryDocument | null>(null);
  const [hasDiscoveryError, setHasDiscoveryError] = useState(false);
  const [hasRequestPreparationError, setHasRequestPreparationError] =
    useState(false);
  useEffect(() => {
    let isCurrent = true;
    setProviderDiscovery(null);
    setHasDiscoveryError(false);
    logDebug('oauth_discovery_started', {
      attempt: discoveryAttempt,
      issuerUrl,
    });

    AuthSession.fetchDiscoveryAsync(issuerUrl)
      .then((result) => {
        if (isCurrent) {
          setProviderDiscovery(result);
          logDebug('oauth_discovery_succeeded', {
            attempt: discoveryAttempt,
            issuerUrl,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        logWarn('oauth_discovery_failed', {
          attempt: discoveryAttempt,
          errorName: error instanceof Error ? error.name : 'UnknownError',
          issuerUrl,
        });
        setHasDiscoveryError(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [discoveryAttempt, issuerUrl]);
  const discovery = useMemo(
    () =>
      providerDiscovery
        ? normalizeIdentityProviderDiscovery(providerDiscovery, issuerUrl)
        : null,
    [issuerUrl, providerDiscovery],
  );
  const [nonce, setNonce] = useState(() => Crypto.randomUUID());
  const [shouldPrompt, setShouldPrompt] = useState(false);
  const signInAttemptInFlightRef = useRef(false);
  const sessionGenerationRef = useRef(0);
  const pendingAuthenticatedActionRef = useRef<
    ((accessToken: string) => Promise<unknown>) | null
  >(null);
  const promptAttemptRef = useRef<string | null>(null);
  const handledResponseRef = useRef<string | null>(null);
  const invalidatedRequestStatesRef = useRef(new Set<string>());
  const redirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        path: 'oauth/callback',
        scheme: MOBILE_OAUTH_SCHEME,
      }),
    [],
  );
  const logoutRedirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        path: 'oauth/logout',
        scheme: MOBILE_OAUTH_SCHEME,
      }),
    [],
  );
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: MOBILE_OAUTH_CLIENT_ID,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: MOBILE_OAUTH_SCOPES,
      extraParams: {
        audience: MOBILE_OAUTH_AUDIENCE,
        nonce,
        prompt: 'consent',
      },
      usePKCE: true,
    },
    discovery,
  );
  useEffect(() => {
    if (!discovery || request) {
      setHasRequestPreparationError(false);
      return;
    }

    const timeout = setTimeout(() => {
      logWarn('oauth_request_preparation_timed_out', {
        timeoutMs: AUTH_REQUEST_PREPARATION_TIMEOUT_MS,
      });
      setHasRequestPreparationError(true);
    }, AUTH_REQUEST_PREPARATION_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [discovery, nonce, request]);
  const [state, setState] = useState<OAuth2AuthState>('idle');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' && !discovery) return;

    let isCurrent = true;
    const sessionGeneration = sessionGenerationRef.current;
    const isCurrentSession = () =>
      isCurrent && sessionGenerationRef.current === sessionGeneration;
    signInAttemptInFlightRef.current = true;
    setState('loading');
    logDebug('auth_session_restore_started');

    loadAccessToken()
      .then(async (storedToken) => {
        if (!isCurrentSession()) return;
        logDebug('auth_session_restore_token_loaded', {
          hasStoredToken: Boolean(storedToken),
        });

        let sessionToken = storedToken;
        if (!sessionToken && Platform.OS === 'web' && discovery) {
          sessionToken = await getValidAccessToken({ forceRefresh: true });
          if (!isCurrentSession()) return;
          if (sessionToken) await saveAccessToken(sessionToken);
          if (!isCurrentSession()) return;
        }
        if (!sessionToken || !isCurrentSession()) {
          if (isCurrentSession()) setState('idle');
          return;
        }

        try {
          if (!isCurrentSession()) return;
          const authenticatedUser = await getAuthenticatedUser(
            sessionToken.idToken,
          );
          if (isCurrentSession()) {
            setIsAuthenticated(true);
            setUser(authenticatedUser);
            setState('success');
            logInfo('auth_session_restored');
          }
        } catch (error) {
          logWarn('auth_session_user_load_failed', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
          if (isCurrentSession()) {
            setIsAuthenticated(false);
            setUser(null);
            setState('error');
          }
        }
      })
      .catch((error: unknown) => {
        logError('auth_session_restore_failed', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        if (isCurrentSession()) setState('error');
      })
      .finally(() => {
        if (isCurrentSession()) {
          signInAttemptInFlightRef.current = false;
        }
      });

    return () => {
      isCurrent = false;
      if (sessionGenerationRef.current === sessionGeneration) {
        signInAttemptInFlightRef.current = false;
      }
    };
  }, [discovery]);

  useEffect(() => {
    if (!shouldPrompt || !request || request.extraParams.nonce !== nonce)
      return;

    const promptKey = `${request.url}:${nonce}`;
    if (promptAttemptRef.current === promptKey) return;

    promptAttemptRef.current = promptKey;
    setShouldPrompt(false);
    handledResponseRef.current = null;
    logInfo('oauth_sign_in_prompt_started', { redirectUri });
    promptAsync().catch((error: unknown) => {
      logWarn('oauth_sign_in_prompt_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      signInAttemptInFlightRef.current = false;
      setState('error');
    });
  }, [nonce, promptAsync, redirectUri, request, shouldPrompt]);

  useEffect(() => {
    if (!response || !discovery) return;

    const responseKey =
      response.type === 'success' || response.type === 'error'
        ? response.url
        : response.type;
    if (
      response.type === 'success' &&
      invalidatedRequestStatesRef.current.has(response.params.state)
    ) {
      handledResponseRef.current = responseKey;
      return;
    }
    if (handledResponseRef.current === responseKey) return;
    handledResponseRef.current = responseKey;

    if (response.type !== 'success') {
      pendingAuthenticatedActionRef.current = null;
      signInAttemptInFlightRef.current = false;
      logInfo('oauth_sign_in_ended', {
        result: response.type,
        ...(response.type === 'error'
          ? { providerError: response.params?.error ?? response.error?.code }
          : {}),
      });
      setState(response.type === 'cancel' ? 'cancelled' : 'error');
      return;
    }

    const code = response.params.code;
    if (
      !code ||
      !request?.codeVerifier ||
      !response.params.state ||
      response.params.state !== request.state
    ) {
      logWarn('oauth_sign_in_response_invalid');
      pendingAuthenticatedActionRef.current = null;
      signInAttemptInFlightRef.current = false;
      setState('error');
      return;
    }

    let isCurrent = true;
    setState('loading');
    logInfo('oauth_authorization_code_exchange_started');
    exchangeAuthorizationCodeForCurrentPlatform({
      code,
      codeVerifier: request.codeVerifier,
      discovery,
      redirectUri,
    })
      .then(async (token) => {
        await saveAccessToken(token);
        logInfo('oauth_authorization_code_exchange_succeeded');
        setIsAuthenticated(true);
        if (!isCurrent) return;
        try {
          const authenticatedUser = await getAuthenticatedUser(token.idToken);
          if (isCurrent) setUser(authenticatedUser);
        } catch (error) {
          logWarn('authenticated_user_load_failed', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
          setUser(null);
        }
        setState('success');
        const pendingAction = pendingAuthenticatedActionRef.current;
        pendingAuthenticatedActionRef.current = null;
        if (pendingAction) {
          try {
            const latestToken = await getValidAccessToken();
            await pendingAction(latestToken?.accessToken ?? token.accessToken);
          } catch (error) {
            logError('authenticated_action_failed', {
              errorName: error instanceof Error ? error.name : 'UnknownError',
            });
            setState('error');
          }
        }
      })
      .catch((error: unknown) => {
        logWarn('oauth_authorization_code_exchange_failed', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        pendingAuthenticatedActionRef.current = null;
        if (isCurrent) setState('error');
      })
      .finally(() => {
        signInAttemptInFlightRef.current = false;
      });

    return () => {
      isCurrent = false;
    };
  }, [discovery, redirectUri, request?.codeVerifier, response]);

  async function callAuthenticatedEndpoint(
    authenticatedAction?: (accessToken: string) => Promise<unknown>,
  ) {
    if (signInAttemptInFlightRef.current) return false;
    signInAttemptInFlightRef.current = true;
    let waitingForCallback = false;

    logDebug('authenticated_action_started');
    setState('loading');
    try {
      let storedToken = await loadAccessToken();
      if (!storedToken && Platform.OS === 'web' && discovery) {
        storedToken = await getValidAccessToken({ forceRefresh: true }).catch(
          () => null,
        );
        if (storedToken) await saveAccessToken(storedToken);
      }
      if (!storedToken) {
        logInfo('auth_sign_in_required');
        if (!request) {
          throw new Error('The OAuth2 request is still being prepared.');
        }
        pendingAuthenticatedActionRef.current = authenticatedAction ?? null;
        setState('authenticating');
        waitingForCallback = true;
        setNonce(Crypto.randomUUID());
        setShouldPrompt(true);
        return false;
      }
      setIsAuthenticated(true);

      let authenticatedUser: AuthenticatedUser;
      try {
        authenticatedUser = await getAuthenticatedUser(storedToken.idToken);
      } catch (error) {
        sessionGenerationRef.current += 1;
        setIsAuthenticated(false);
        setUser(null);
        await clearAuthenticatedSession();
        throw error;
      }

      const currentToken = await getValidAccessToken();
      const accessToken = currentToken?.accessToken ?? storedToken.accessToken;
      setUser(authenticatedUser);
      setState('success');
      if (authenticatedAction) {
        await authenticatedAction(accessToken);
      }
      logInfo('authenticated_action_succeeded');
      return true;
    } catch (error) {
      logWarn('authenticated_action_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      setState('error');
      if (authenticatedAction) throw error;
      return false;
    } finally {
      if (!waitingForCallback) {
        signInAttemptInFlightRef.current = false;
      }
    }
  }

  async function refreshAuthenticatedSession() {
    logInfo('auth_session_refresh_started');
    setState('loading');
    try {
      if (!discovery) {
        throw new Error('The OAuth2 discovery document is still loading.');
      }
      const storedToken = await loadAccessToken();
      if (!storedToken) {
        throw new Error('No authenticated session is available to refresh.');
      }

      const refreshedToken = await getValidAccessToken({ forceRefresh: true });
      if (!refreshedToken) {
        throw new Error('No authenticated session is available to refresh.');
      }
      setIsAuthenticated(true);
      const authenticatedUser = await getAuthenticatedUser(
        refreshedToken.idToken,
      );
      setUser(authenticatedUser);
      setState('success');
      logInfo('auth_session_refresh_succeeded');
    } catch (error) {
      logWarn('auth_session_refresh_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      setState('error');
      throw error;
    }
  }

  async function signOut() {
    logInfo('auth_sign_out_started');
    sessionGenerationRef.current += 1;
    signInAttemptInFlightRef.current = false;
    setState('loading');
    try {
      const storedToken = await loadAccessToken();
      if (storedToken?.refreshToken && discovery) {
        await revokeRefreshToken(storedToken.refreshToken, discovery);
      }
    } catch (error) {
      logWarn('auth_sign_out_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    } finally {
      await clearAuthenticatedSession();
      setIsAuthenticated(false);
      setUser(null);
      setState('idle');
      logInfo('auth_sign_out_completed');
    }
  }

  function retryAuthenticationSetup() {
    logInfo('oauth_setup_retry_requested', {
      attempt: discoveryAttempt + 1,
    });
    setHasDiscoveryError(false);
    setHasRequestPreparationError(false);
    setNonce(Crypto.randomUUID());
    setDiscoveryAttempt((attempt) => attempt + 1);
  }

  async function resetAuthentication() {
    sessionGenerationRef.current += 1;
    signInAttemptInFlightRef.current = false;
    let storedToken: StoredAccessToken | null = null;
    try {
      storedToken = await loadAccessToken();
    } catch (error) {
      // Continue clearing local state even when storage is unavailable.
      logWarn('auth_reset_token_lookup_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
    const postLogoutRedirectUri =
      MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI || logoutRedirectUri;
    const providerLogoutUrl = discovery
      ? createProviderLogoutUrl(
          discovery,
          postLogoutRedirectUri,
          storedToken?.idToken,
        )
      : null;

    if (Platform.OS !== 'android') {
      AuthSession.dismiss();
    }
    setShouldPrompt(false);
    promptAttemptRef.current = null;
    if (request?.state) {
      invalidatedRequestStatesRef.current.add(request.state);
    }
    handledResponseRef.current = response
      ? response.type === 'success' || response.type === 'error'
        ? response.url
        : response.type
      : null;

    try {
      await clearAuthenticatedSession();
      if (providerLogoutUrl) {
        await WebBrowser.openAuthSessionAsync(
          providerLogoutUrl,
          postLogoutRedirectUri,
        );
      }
    } finally {
      setNonce(Crypto.randomUUID());
      setIsAuthenticated(false);
      setUser(null);
      setState('idle');
    }
  }

  return {
    callAuthenticatedEndpoint,
    hasSetupError: hasDiscoveryError || hasRequestPreparationError,
    isReady: Boolean(discovery && request),
    isAuthenticated,
    refreshAuthenticatedSession,
    retryAuthenticationSetup,
    resetAuthentication,
    redirectUri,
    signOut,
    state,
    user,
  };
}
