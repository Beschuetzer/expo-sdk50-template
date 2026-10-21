import * as AuthSession from 'expo-auth-session';
import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { useOAuth2AuthState } from './useOAuth2Auth';

const storedToken = {
  accessToken: 'stored-access-token',
  expiresAt: Date.now() + 60_000,
  idToken: 'stored-id-token',
  refreshToken: 'stored-refresh-token',
  scope: 'openid',
  tokenType: 'Bearer' as const,
};
const refreshedToken = {
  ...storedToken,
  accessToken: 'refreshed-access-token',
};
const authenticatedUser = {
  claims: { sub: 'user-1' },
  subject: 'user-1',
};
let mockDiscovery: {
  authorizationEndpoint: string;
  tokenEndpoint: string;
} | null = {
  authorizationEndpoint: 'https://identity.example.com/authorize',
  tokenEndpoint: 'https://identity.example.com/token',
};
let mockPromptResponse: unknown = { type: 'cancel' };
let mockNonceCounter = 0;
let mockAuthRequestReady = true;
let mockRequestState = 'test-state';
let mockCodeVerifier: string | undefined = 'test-code-verifier';
let mockRequestNonce: string | undefined;
const mockPromptAsync = jest.fn(async () => mockPromptResponse);
const mockLoadAccessToken = jest.fn<Promise<typeof storedToken | null>, []>(
  async () => null,
);
const mockExchangeAuthorizationCode = jest.fn();
const mockGetAuthenticatedUser = jest.fn();
const mockRefreshAccessToken = jest.fn();
const mockSaveAccessToken = jest.fn();
const mockClearAuthenticatedSession = jest.fn();
const mockCreateProviderLogoutUrl = jest.fn();
const mockRevokeRefreshToken = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
let mockSetAuthResponse: ((response: unknown) => void) | null = null;
let mountedRenderer: ReactTestRenderer | null = null;

function setPlatformOs(os: string) {
  Object.defineProperty(require('react-native'), 'Platform', {
    configurable: true,
    value: { OS: os },
  });
}

async function flushPromises() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await Promise.resolve();
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function renderAuth() {
  let currentAuth: ReturnType<typeof useOAuth2AuthState> | null = null;
  function TestConsumer() {
    currentAuth = useOAuth2AuthState();
    return null;
  }

  await act(async () => {
    mountedRenderer = renderer.create(<TestConsumer />);
    await flushPromises();
  });

  return () => {
    if (!currentAuth) throw new Error('Auth hook did not render.');
    return currentAuth;
  };
}

async function completePrompt(
  auth: () => ReturnType<typeof useOAuth2AuthState>,
  response: unknown = mockPromptResponse,
  authenticatedAction?: (accessToken: string) => Promise<unknown>,
) {
  await act(async () => {
    await auth().callAuthenticatedEndpoint(authenticatedAction);
    await flushPromises();
    if (!mockSetAuthResponse) throw new Error('Auth response setter missing.');
    mockSetAuthResponse(
      response && typeof response === 'object' ? { ...response } : response,
    );
    await flushPromises();
  });
  await act(async () => {
    await flushPromises();
  });
}

jest.mock('expo-auth-session', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    CodeChallengeMethod: { S256: 'S256' },
    ResponseType: { Code: 'code' },
    makeRedirectUri: jest.fn(() => 'oauth-test-scheme://oauth/callback'),
    dismiss: jest.fn(),
    useAutoDiscovery: () => mockDiscovery,
    useAuthRequest: (config: { extraParams: { nonce: string } }) => {
      const [response, setResponse] = React.useState<unknown>(null);
      mockSetAuthResponse = setResponse;
      const request = mockAuthRequestReady
        ? {
            codeVerifier: mockCodeVerifier,
            extraParams: {
              ...config.extraParams,
              ...(mockRequestNonce ? { nonce: mockRequestNonce } : {}),
            },
            state: mockRequestState,
            url: `https://identity.example.com/authorize?nonce=${config.extraParams.nonce}`,
          }
        : null;
      const promptAsync = React.useCallback(async () => {
        return mockPromptAsync();
      }, [request?.url]);

      return [request, response, promptAsync];
    },
  };
});

jest.mock('expo-crypto', () => ({
  randomUUID: () => `test-nonce-${++mockNonceCounter}`,
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) =>
    mockOpenAuthSessionAsync(...args),
}));

jest.mock('../client', () => ({
  createProviderLogoutUrl: (...args: unknown[]) =>
    mockCreateProviderLogoutUrl(...args),
  exchangeAuthorizationCodeForCurrentPlatform: (...args: unknown[]) =>
    mockExchangeAuthorizationCode(...args),
  getAuthenticatedUser: (...args: unknown[]) =>
    mockGetAuthenticatedUser(...args),
  MOBILE_OAUTH_AUDIENCE: 'test-audience',
  MOBILE_OAUTH_CLIENT_ID: 'test-client',
  MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI: '',
  MOBILE_OAUTH_SCHEME: 'oauth-test-scheme',
  MOBILE_OAUTH_SCOPES: ['openid'],
  normalizeIdentityProviderDiscovery: (discovery: unknown) => discovery,
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  revokeRefreshToken: (...args: unknown[]) => mockRevokeRefreshToken(...args),
}));

jest.mock('../storage', () => ({
  clearAuthenticatedSession: (...args: unknown[]) =>
    mockClearAuthenticatedSession(...args),
  loadAccessToken: () => mockLoadAccessToken(),
  saveAccessToken: (...args: unknown[]) => mockSaveAccessToken(...args),
}));

jest.mock('@/utils/platform', () => ({
  getIdentityProviderUrl: () => 'https://identity.example.com',
}));

describe('useOAuth2AuthState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDiscovery = {
      authorizationEndpoint: 'https://identity.example.com/authorize',
      tokenEndpoint: 'https://identity.example.com/token',
    };
    mockNonceCounter = 0;
    mockPromptResponse = { type: 'cancel' };
    mockAuthRequestReady = true;
    mockRequestState = 'test-state';
    mockCodeVerifier = 'test-code-verifier';
    mockRequestNonce = undefined;
    mockPromptAsync.mockImplementation(async () => mockPromptResponse);
    mockLoadAccessToken.mockResolvedValue(null);
    mockExchangeAuthorizationCode.mockResolvedValue(refreshedToken);
    mockGetAuthenticatedUser.mockResolvedValue(authenticatedUser);
    mockRefreshAccessToken.mockResolvedValue(refreshedToken);
    mockSaveAccessToken.mockResolvedValue(undefined);
    mockClearAuthenticatedSession.mockResolvedValue(undefined);
    mockCreateProviderLogoutUrl.mockReturnValue(null);
    mockRevokeRefreshToken.mockResolvedValue(undefined);
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success' });
    setPlatformOs('android');
  });

  afterEach(() => {
    if (mountedRenderer) {
      act(() => mountedRenderer?.unmount());
      mountedRenderer = null;
    }
    setPlatformOs('android');
  });

  it('restores the user from a stored access token on startup', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);

    const auth = await renderAuth();

    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user).toEqual(authenticatedUser);
    expect(mockGetAuthenticatedUser).toHaveBeenCalledWith(
      storedToken.accessToken,
      storedToken.idToken,
    );
  });

  it('does not restore the user when sign-out beats the startup profile request', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    let resolveStartupProfile!: (user: typeof authenticatedUser) => void;
    mockGetAuthenticatedUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStartupProfile = resolve;
        }),
    );

    const auth = await renderAuth();

    await act(async () => {
      await auth().signOut();
      await flushPromises();
    });
    await act(async () => {
      resolveStartupProfile(authenticatedUser);
      await flushPromises();
    });

    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().state).toBe('idle');
  });

  it('does not save a web token when sign-out beats startup refresh', async () => {
    setPlatformOs('web');
    let resolveStartupRefresh!: (token: typeof refreshedToken) => void;
    mockRefreshAccessToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStartupRefresh = resolve;
        }),
    );

    const auth = await renderAuth();

    await act(async () => {
      await auth().signOut();
      await flushPromises();
    });
    await act(async () => {
      resolveStartupRefresh(refreshedToken);
      await flushPromises();
    });

    expect(mockSaveAccessToken).not.toHaveBeenCalled();
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().state).toBe('idle');
  });

  it('passes the authenticated access token to a protected action', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);

    const auth = await renderAuth();
    const authenticatedAction = jest.fn(
      async (accessToken: string) => accessToken,
    );
    let completed = false;

    await act(async () => {
      completed = await auth().callAuthenticatedEndpoint(authenticatedAction);
      await flushPromises();
    });

    expect(completed).toBe(true);
    expect(authenticatedAction).toHaveBeenCalledWith(storedToken.accessToken);
  });

  it('propagates protected-action failures and marks auth state as error', async () => {
    const actionError = new Error('protected action failed');
    mockLoadAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedToken);
    const auth = await renderAuth();

    await act(async () => {
      await expect(
        auth().callAuthenticatedEndpoint(async () => {
          throw actionError;
        }),
      ).rejects.toBe(actionError);
      await flushPromises();
    });

    expect(auth().state).toBe('error');
  });

  it('refreshes a stored session during startup when the user lookup fails', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    mockGetAuthenticatedUser.mockRejectedValueOnce(new Error('expired token'));

    const auth = await renderAuth();

    expect(mockRefreshAccessToken).toHaveBeenCalledWith(
      storedToken,
      mockDiscovery,
    );
    expect(mockSaveAccessToken).toHaveBeenCalledWith(refreshedToken);
    expect(auth().state).toBe('success');
    expect(auth().user).toEqual(authenticatedUser);
  });

  it('clears authenticated state when startup token refresh fails', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    mockGetAuthenticatedUser.mockRejectedValue(new Error('invalid token'));
    mockRefreshAccessToken.mockRejectedValue(new Error('refresh failed'));

    const auth = await renderAuth();

    expect(auth().state).toBe('error');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
  });

  it('restores a web session by refreshing when no token is stored', async () => {
    setPlatformOs('web');
    mockRefreshAccessToken.mockResolvedValue(refreshedToken);

    const auth = await renderAuth();

    expect(mockRefreshAccessToken).toHaveBeenCalledWith(
      undefined,
      mockDiscovery,
    );
    expect(mockSaveAccessToken).toHaveBeenCalledWith(refreshedToken);
    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
  });

  it('exchanges a valid authorization callback and loads the user', async () => {
    mockPromptResponse = {
      type: 'success',
      url: 'oauth-test-scheme://oauth/callback?code=auth-code&state=test-state',
      params: { code: 'auth-code', state: 'test-state' },
    };
    const auth = await renderAuth();

    await completePrompt(auth);

    expect(mockExchangeAuthorizationCode).toHaveBeenCalledWith({
      code: 'auth-code',
      codeVerifier: 'test-code-verifier',
      discovery: mockDiscovery,
      redirectUri: 'oauth-test-scheme://oauth/callback',
    });
    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user).toEqual(authenticatedUser);
  });

  it('runs a pending authenticated action after sign-in completes', async () => {
    mockPromptResponse = {
      type: 'success',
      url: 'oauth-test-scheme://oauth/callback?code=auth-code&state=test-state',
      params: { code: 'auth-code', state: 'test-state' },
    };
    const auth = await renderAuth();
    const authenticatedAction = jest.fn(
      async (accessToken: string) => accessToken,
    );

    await completePrompt(auth, mockPromptResponse, authenticatedAction);

    expect(authenticatedAction).toHaveBeenCalledWith(
      refreshedToken.accessToken,
    );
  });

  it.each([
    ['missing code', undefined, 'test-state', 'test-code-verifier'],
    ['missing verifier', 'auth-code', 'test-state', undefined],
    ['missing state', 'auth-code', undefined, 'test-code-verifier'],
    ['mismatched state', 'auth-code', 'other-state', 'test-code-verifier'],
  ])('rejects a callback with %s', async (
    _caseName,
    code,
    state,
    codeVerifier,
  ) => {
    mockCodeVerifier = codeVerifier;
    mockPromptResponse = {
      type: 'success',
      url: `oauth-test-scheme://oauth/callback?${String(code)}&${String(state)}`,
      params: { code, state },
    };
    const auth = await renderAuth();

    await completePrompt(auth);

    expect(auth().state).toBe('error');
    expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it('sets an error when authorization-code exchange fails', async () => {
    mockExchangeAuthorizationCode.mockRejectedValue(
      new Error('exchange rejected'),
    );
    mockPromptResponse = {
      type: 'success',
      url: 'oauth-test-scheme://oauth/callback?code=auth-code&state=test-state',
      params: { code: 'auth-code', state: 'test-state' },
    };
    const auth = await renderAuth();

    await completePrompt(auth);

    expect(auth().state).toBe('error');
    expect(auth().isAuthenticated).toBe(false);
  });

  it('keeps an authenticated session when the profile request fails after login', async () => {
    mockGetAuthenticatedUser.mockRejectedValueOnce(
      new Error('profile request failed'),
    );
    mockPromptResponse = {
      type: 'success',
      url: 'oauth-test-scheme://oauth/callback?code=auth-code&state=test-state',
      params: { code: 'auth-code', state: 'test-state' },
    };
    const auth = await renderAuth();

    await completePrompt(auth);

    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user).toBeNull();
  });

  it('reports an error when the OAuth request is not ready', async () => {
    mockAuthRequestReady = false;
    const auth = await renderAuth();

    expect(auth().isReady).toBe(false);
    await act(async () => {
      await auth().callAuthenticatedEndpoint();
    });

    expect(auth().state).toBe('error');
    expect(mockPromptAsync).not.toHaveBeenCalled();
  });

  it('uses a stored access token to load the authenticated user', async () => {
    mockLoadAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedToken);
    const auth = await renderAuth();

    await act(async () => {
      await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(mockGetAuthenticatedUser).toHaveBeenCalledWith(
      storedToken.accessToken,
      storedToken.idToken,
    );
    expect(auth().state).toBe('success');
    expect(auth().user).toEqual(authenticatedUser);
  });

  it('refreshes a stored access token when the user endpoint rejects it', async () => {
    mockLoadAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedToken);
    mockGetAuthenticatedUser.mockRejectedValueOnce(new Error('expired token'));
    const auth = await renderAuth();

    await act(async () => {
      await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(mockRefreshAccessToken).toHaveBeenCalledWith(
      storedToken,
      mockDiscovery,
    );
    expect(mockSaveAccessToken).toHaveBeenCalledWith(refreshedToken);
    expect(auth().state).toBe('success');
  });

  it('clears an invalid stored session when refresh is unavailable', async () => {
    setPlatformOs('web');
    mockDiscovery = null;
    mockLoadAccessToken.mockResolvedValue(storedToken);
    const auth = await renderAuth();

    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user).toEqual(authenticatedUser);
    mockGetAuthenticatedUser.mockRejectedValue(new Error('request failed'));

    await act(async () => {
      await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(mockClearAuthenticatedSession).toHaveBeenCalled();
    expect(auth().state).toBe('error');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
  });

  it('refreshes a web token before calling the authenticated endpoint', async () => {
    setPlatformOs('web');
    const auth = await renderAuth();

    await act(async () => {
      await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(mockRefreshAccessToken).toHaveBeenCalledWith(
      undefined,
      mockDiscovery,
    );
    expect(mockSaveAccessToken).toHaveBeenCalledWith(refreshedToken);
    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
  });

  it('starts sign-in when refreshing a web session fails', async () => {
    setPlatformOs('web');
    mockRefreshAccessToken.mockRejectedValue(new Error('no web session'));
    const auth = await renderAuth();
    let completed: boolean | undefined;

    await act(async () => {
      completed = await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(completed).toBe(false);
    expect(mockPromptAsync).toHaveBeenCalledTimes(1);
    expect(auth().state).toBe('authenticating');
  });

  it('ignores a duplicate OAuth response', async () => {
    const auth = await renderAuth();

    await completePrompt(auth);
    await act(async () => {
      mockSetAuthResponse?.({ type: 'cancel' });
      await flushPromises();
    });

    expect(auth().state).toBe('cancelled');
    expect(mockPromptAsync).toHaveBeenCalledTimes(1);
  });

  it('ignores a callback invalidated by an authentication reset', async () => {
    const auth = await renderAuth();

    await act(async () => {
      await auth().resetAuthentication();
      mockSetAuthResponse?.({
        type: 'success',
        url: 'oauth-test-scheme://oauth/callback?code=auth-code&state=test-state',
        params: { code: 'auth-code', state: 'test-state' },
      });
      await flushPromises();
    });

    expect(auth().state).toBe('idle');
    expect(auth().isAuthenticated).toBe(false);
    expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it('sets an error state when the provider returns an OAuth error', async () => {
    mockPromptResponse = {
      type: 'error',
      url: 'oauth-test-scheme://oauth/callback?error=access_denied',
    };
    const auth = await renderAuth();

    await completePrompt(auth);

    expect(auth().state).toBe('error');
  });

  it('refreshes an authenticated session and reloads the user', async () => {
    mockLoadAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedToken);
    const auth = await renderAuth();

    await act(async () => {
      await auth().refreshAuthenticatedSession();
      await flushPromises();
    });

    expect(mockRefreshAccessToken).toHaveBeenCalledWith(
      storedToken,
      mockDiscovery,
    );
    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user).toEqual(authenticatedUser);
  });

  it('rejects a session refresh while discovery is unavailable', async () => {
    mockDiscovery = null;
    const auth = await renderAuth();

    await act(async () => {
      await expect(auth().refreshAuthenticatedSession()).rejects.toThrow(
        'The OAuth2 discovery document is still loading.',
      );
    });

    expect(auth().state).toBe('error');
  });

  it('rejects a session refresh when no stored token exists', async () => {
    const auth = await renderAuth();

    await act(async () => {
      await expect(auth().refreshAuthenticatedSession()).rejects.toThrow(
        'No authenticated session is available to refresh.',
      );
    });

    expect(auth().state).toBe('error');
  });

  it('sets error state when session refresh fails', async () => {
    mockLoadAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedToken);
    mockRefreshAccessToken.mockRejectedValue(new Error('refresh failed'));
    const auth = await renderAuth();

    await act(async () => {
      await expect(auth().refreshAuthenticatedSession()).rejects.toThrow(
        'refresh failed',
      );
    });

    expect(auth().state).toBe('error');
  });

  it('revokes the refresh token and clears local state on sign out', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    const auth = await renderAuth();

    await act(async () => {
      await auth().signOut();
      await flushPromises();
    });

    expect(mockRevokeRefreshToken).toHaveBeenCalledWith(
      storedToken.refreshToken,
      mockDiscovery,
    );
    expect(mockClearAuthenticatedSession).toHaveBeenCalled();
    expect(auth().state).toBe('idle');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
  });

  it('clears local state when token revocation fails during sign out', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    mockRevokeRefreshToken.mockRejectedValue(new Error('revocation failed'));
    const auth = await renderAuth();

    await act(async () => {
      await expect(auth().signOut()).rejects.toThrow('revocation failed');
    });

    expect(mockClearAuthenticatedSession).toHaveBeenCalled();
    expect(auth().state).toBe('idle');
    expect(auth().isAuthenticated).toBe(false);
  });

  it('opens provider logout and resets local state', async () => {
    setPlatformOs('ios');
    mockLoadAccessToken.mockResolvedValue(storedToken);
    mockCreateProviderLogoutUrl.mockReturnValue(
      'https://identity.example.com/logout',
    );
    const auth = await renderAuth();

    await act(async () => {
      await auth().resetAuthentication();
    });

    expect(AuthSession.dismiss).toHaveBeenCalled();
    expect(mockCreateProviderLogoutUrl).toHaveBeenCalledWith(
      mockDiscovery,
      'oauth-test-scheme://oauth/callback',
      storedToken.idToken,
    );
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://identity.example.com/logout',
      'oauth-test-scheme://oauth/callback',
    );
    expect(auth().state).toBe('idle');
    expect(auth().isAuthenticated).toBe(false);
  });

  it('resets locally on Android when token loading fails', async () => {
    mockLoadAccessToken.mockRejectedValue(new Error('storage unavailable'));
    const auth = await renderAuth();

    await act(async () => {
      await auth().resetAuthentication();
    });

    expect(AuthSession.dismiss).not.toHaveBeenCalled();
    expect(mockCreateProviderLogoutUrl).toHaveBeenCalledWith(
      mockDiscovery,
      'oauth-test-scheme://oauth/callback',
      undefined,
    );
    expect(mockClearAuthenticatedSession).toHaveBeenCalled();
    expect(auth().state).toBe('idle');
  });

  it('resets local state if provider logout fails', async () => {
    mockCreateProviderLogoutUrl.mockReturnValue(
      'https://identity.example.com/logout',
    );
    mockOpenAuthSessionAsync.mockRejectedValue(new Error('browser failed'));
    const auth = await renderAuth();

    await act(async () => {
      await expect(auth().resetAuthentication()).rejects.toThrow(
        'browser failed',
      );
    });

    expect(mockClearAuthenticatedSession).toHaveBeenCalled();
    expect(auth().state).toBe('idle');
    expect(auth().isAuthenticated).toBe(false);
  });

  it('clears authenticating state after repeated browser dismissals', async () => {
    const auth = await renderAuth();

    expect(AuthSession.makeRedirectUri).toHaveBeenCalledWith({
      path: 'oauth/callback',
      scheme: 'oauth-test-scheme',
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await completePrompt(auth);

      expect(mockPromptAsync).toHaveBeenCalledTimes(attempt + 1);
      expect(auth().state).toBe('cancelled');
    }

    expect(mockPromptAsync).toHaveBeenCalledTimes(2);
  });
});
