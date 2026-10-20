import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  createProviderLogoutUrl,
  exchangeAuthorizationCodeForCurrentPlatform,
  getAuthenticatedUser,
  MOBILE_OAUTH_AUDIENCE,
  MOBILE_OAUTH_CLIENT_ID,
  MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI,
  MOBILE_OAUTH_SCHEME,
  MOBILE_OAUTH_SCOPES,
  revokeRefreshToken,
  refreshAccessToken,
  type AuthenticatedUser,
  normalizeIdentityProviderDiscovery,
} from '../client';
import {
  clearAuthenticatedSession,
  loadAccessToken,
  saveAccessToken,
  type StoredAccessToken,
} from '../storage';

import { getIdentityProviderUrl } from '@/utils/platform';

WebBrowser.maybeCompleteAuthSession();

export type OAuth2AuthState =
  | 'idle'
  | 'authenticating'
  | 'loading'
  | 'success'
  | 'cancelled'
  | 'error';

export function useOAuth2AuthState() {
  if (!MOBILE_OAUTH_CLIENT_ID) {
    throw new Error(
      'EXPO_PUBLIC_OAUTH_CLIENT_ID must be set from AUTH_CLIENT_ID.',
    );
  }

  const issuerUrl = getIdentityProviderUrl();
  const providerDiscovery = AuthSession.useAutoDiscovery(issuerUrl);
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
  const [state, setState] = useState<OAuth2AuthState>('idle');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' && !discovery) return;

    let isCurrent = true;

    loadAccessToken()
      .then(async (storedToken) => {
        let sessionToken = storedToken;
        if (!sessionToken && Platform.OS === 'web' && discovery) {
          sessionToken = await refreshAccessToken(undefined, discovery);
          await saveAccessToken(sessionToken);
        }
        if (!sessionToken || !isCurrent) return;

        try {
          let authenticatedUser: AuthenticatedUser;
          try {
            authenticatedUser = await getAuthenticatedUser(
              sessionToken.accessToken,
              sessionToken.idToken,
            );
          } catch (error) {
            if (!discovery) throw error;

            const refreshedToken = await refreshAccessToken(
              sessionToken,
              discovery,
            );
            await saveAccessToken(refreshedToken);
            authenticatedUser = await getAuthenticatedUser(
              refreshedToken.accessToken,
              refreshedToken.idToken,
            );
          }

          if (isCurrent) {
            setIsAuthenticated(true);
            setUser(authenticatedUser);
            setState('success');
          }
        } catch {
          if (isCurrent) {
            setIsAuthenticated(false);
            setUser(null);
            setState('error');
          }
        }
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
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
    promptAsync().catch(() => {
      signInAttemptInFlightRef.current = false;
      setState('error');
    });
  }, [nonce, promptAsync, request, shouldPrompt]);

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
      pendingAuthenticatedActionRef.current = null;
      signInAttemptInFlightRef.current = false;
      setState('error');
      return;
    }

    let isCurrent = true;
    setState('loading');
    exchangeAuthorizationCodeForCurrentPlatform({
      code,
      codeVerifier: request.codeVerifier,
      discovery,
      redirectUri,
    })
      .then(async (token) => {
        await saveAccessToken(token);
        setIsAuthenticated(true);
        if (!isCurrent) return;
        try {
          const authenticatedUser = await getAuthenticatedUser(
            token.accessToken,
            token.idToken,
          );
          if (isCurrent) setUser(authenticatedUser);
        } catch {
          setUser(null);
        }
        setState('success');
        const pendingAction = pendingAuthenticatedActionRef.current;
        pendingAuthenticatedActionRef.current = null;
        if (pendingAction) {
          try {
            await pendingAction(token.accessToken);
          } catch {
            setState('error');
          }
        }
      })
      .catch(() => {
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

    setState('loading');
    try {
      let storedToken = await loadAccessToken();
      if (!storedToken && Platform.OS === 'web' && discovery) {
        storedToken = await refreshAccessToken(undefined, discovery).catch(
          () => null,
        );
        if (storedToken) await saveAccessToken(storedToken);
      }
      if (!storedToken) {
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

      let accessToken = storedToken.accessToken;
      let authenticatedUser: AuthenticatedUser;
      try {
        authenticatedUser = await getAuthenticatedUser(
          storedToken.accessToken,
          storedToken.idToken,
        );
      } catch (error) {
        try {
          if (!discovery) {
            throw new Error('The OAuth2 discovery document is still loading.');
          }
          const refreshedToken = await refreshAccessToken(
            storedToken,
            discovery,
          );
          await saveAccessToken(refreshedToken);
          accessToken = refreshedToken.accessToken;
          setIsAuthenticated(true);
          authenticatedUser = await getAuthenticatedUser(
            refreshedToken.accessToken,
            refreshedToken.idToken,
          );
        } catch {
          await clearAuthenticatedSession();
          throw error;
        }
      }

      setUser(authenticatedUser);
      setState('success');
      if (authenticatedAction) {
        await authenticatedAction(accessToken);
      }
      return true;
    } catch (error) {
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
    setState('loading');
    try {
      if (!discovery) {
        throw new Error('The OAuth2 discovery document is still loading.');
      }
      const storedToken = await loadAccessToken();
      if (!storedToken) {
        throw new Error('No authenticated session is available to refresh.');
      }

      const refreshedToken = await refreshAccessToken(storedToken, discovery);
      await saveAccessToken(refreshedToken);
      setIsAuthenticated(true);
      const authenticatedUser = await getAuthenticatedUser(
        refreshedToken.accessToken,
        refreshedToken.idToken,
      );
      setUser(authenticatedUser);
      setState('success');
    } catch (error) {
      setState('error');
      throw error;
    }
  }

  async function signOut() {
    setState('loading');
    try {
      const storedToken = await loadAccessToken();
      if (storedToken?.refreshToken && discovery) {
        await revokeRefreshToken(storedToken.refreshToken, discovery);
      }
    } finally {
      await clearAuthenticatedSession();
      setIsAuthenticated(false);
      setUser(null);
      setState('idle');
    }
  }

  async function resetAuthentication() {
    let storedToken: StoredAccessToken | null = null;
    try {
      storedToken = await loadAccessToken();
    } catch {
      // Continue clearing local state even when storage is unavailable.
    }
    const postLogoutRedirectUri =
      MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI || redirectUri;
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
    signInAttemptInFlightRef.current = false;
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
    isReady: Boolean(request),
    isAuthenticated,
    refreshAuthenticatedSession,
    resetAuthentication,
    redirectUri,
    signOut,
    state,
    user,
  };
}
