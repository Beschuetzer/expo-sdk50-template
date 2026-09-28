import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';

import {
  createIdentityProviderDiscovery,
  exchangeAuthorizationCodeForCurrentPlatform,
  getAuthenticatedUser,
  MOBILE_OAUTH_CLIENT_ID,
  MOBILE_OAUTH_SCOPES,
  revokeRefreshToken,
  refreshAccessToken,
  type AuthenticatedUser,
} from '../client';
import {
  clearAuthenticatedSession,
  loadAccessToken,
  saveAccessToken,
} from '../storage';

WebBrowser.maybeCompleteAuthSession();

export type OAuth2AuthState =
  | 'idle'
  | 'authenticating'
  | 'loading'
  | 'success'
  | 'cancelled'
  | 'error';

export function useOAuth2Auth() {
  const discovery = useMemo(createIdentityProviderDiscovery, []);
  const redirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        path: 'oauth/callback',
        scheme: 'expo50sdktemplate',
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
      usePKCE: true,
    },
    discovery,
  );
  const [state, setState] = useState<OAuth2AuthState>('idle');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    if (!response) return;

    if (response.type !== 'success') {
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
        return getAuthenticatedUser(token.accessToken);
      })
      .then((authenticatedUser) => {
        if (!isCurrent) return;
        setUser(authenticatedUser);
        setState('success');
      })
      .catch(() => {
        if (isCurrent) setState('error');
      });

    return () => {
      isCurrent = false;
    };
  }, [discovery, redirectUri, request?.codeVerifier, response]);

  async function callAuthenticatedEndpoint() {
    setState('loading');
    try {
      const storedToken = await loadAccessToken();
      if (!storedToken) {
        if (!request) {
          throw new Error('The OAuth2 request is still being prepared.');
        }
        setState('authenticating');
        await promptAsync();
        return;
      }

      try {
        const authenticatedUser = await getAuthenticatedUser(
          storedToken.accessToken,
        );
        setUser(authenticatedUser);
        setState('success');
      } catch (error) {
        try {
          const refreshedToken = await refreshAccessToken(
            storedToken,
            discovery,
          );
          await saveAccessToken(refreshedToken);
          const authenticatedUser = await getAuthenticatedUser(
            refreshedToken.accessToken,
          );
          setUser(authenticatedUser);
          setState('success');
        } catch {
          await clearAuthenticatedSession();
          throw error;
        }
      }
    } catch {
      setState('error');
    }
  }

  async function refreshAuthenticatedSession() {
    setState('loading');
    try {
      const storedToken = await loadAccessToken();
      if (!storedToken) {
        throw new Error('No authenticated session is available to refresh.');
      }

      const refreshedToken = await refreshAccessToken(storedToken, discovery);
      await saveAccessToken(refreshedToken);
      const authenticatedUser = await getAuthenticatedUser(
        refreshedToken.accessToken,
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
      if (storedToken?.refreshToken) {
        await revokeRefreshToken(storedToken.refreshToken, discovery);
      }
    } finally {
      await clearAuthenticatedSession();
      setUser(null);
      setState('idle');
    }
  }

  return {
    callAuthenticatedEndpoint,
    isReady: Boolean(request),
    refreshAuthenticatedSession,
    redirectUri,
    signOut,
    state,
    user,
  };
}
