import * as AuthSession from 'expo-auth-session';
import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { useOAuth2AuthState } from './useOAuth2Auth';
import {
  ApiRequestTimeoutError,
  AuthenticatedRequestError,
  DefinitiveOAuthRejectionError,
  RefreshOutcomeUnknownError,
} from '../errors';

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
let mockDiscoveryError: Error | null = null;
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
const mockGetValidAccessToken = jest.fn();
const mockSaveAccessToken = jest.fn();
const mockClearAuthenticatedSession = jest.fn();
const mockCreateProviderLogoutUrl = jest.fn();
const mockRevokeRefreshToken = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockLogWarn = jest.fn();
let mockSetAuthResponse: ((response: unknown) => void) | null = null;
let mockRefreshOutcomeUnknownListener: (() => void) | null = null;
const mockSubscribeToRefreshOutcomeUnknown = jest.fn((listener: () => void) => {
  mockRefreshOutcomeUnknownListener = listener;
  return () => {
    if (mockRefreshOutcomeUnknownListener === listener) {
      mockRefreshOutcomeUnknownListener = null;
    }
  };
});
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
    makeRedirectUri: jest.fn(
      ({ path }: { path: string }) => `oauth-test-scheme://${path}`,
    ),
    dismiss: jest.fn(),
    fetchDiscoveryAsync: () =>
      mockDiscoveryError
        ? Promise.reject(mockDiscoveryError)
        : Promise.resolve(mockDiscovery),
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
  MOBILE_OAUTH_AUDIENCE: 'test-audience',
  MOBILE_OAUTH_CLIENT_ID: 'test-client',
  MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI: '',
  MOBILE_OAUTH_SCHEME: 'oauth-test-scheme',
  MOBILE_OAUTH_SCOPES: ['openid'],
  normalizeIdentityProviderDiscovery: (discovery: unknown) => discovery,
  revokeRefreshToken: (...args: unknown[]) => mockRevokeRefreshToken(...args),
}));

jest.mock('../authenticatedUser', () => ({
  getAuthenticatedUser: (...args: unknown[]) =>
    mockGetAuthenticatedUser(...args),
}));

jest.mock('../tokenManager', () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
  subscribeToRefreshOutcomeUnknown: (listener: () => void) =>
    mockSubscribeToRefreshOutcomeUnknown(listener),
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

jest.mock('@/utils/logging', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
}));

describe('useOAuth2AuthState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDiscovery = {
      authorizationEndpoint: 'https://identity.example.com/authorize',
      tokenEndpoint: 'https://identity.example.com/token',
    };
    mockDiscoveryError = null;
    mockNonceCounter = 0;
    mockPromptResponse = { type: 'cancel' };
    mockAuthRequestReady = true;
    mockRequestState = 'test-state';
    mockCodeVerifier = 'test-code-verifier';
    mockRequestNonce = undefined;
    mockRefreshOutcomeUnknownListener = null;
    mockPromptAsync.mockImplementation(async () => mockPromptResponse);
    mockLoadAccessToken.mockResolvedValue(null);
    mockExchangeAuthorizationCode.mockResolvedValue(refreshedToken);
    mockGetAuthenticatedUser.mockResolvedValue(authenticatedUser);
    mockGetValidAccessToken.mockResolvedValue(storedToken);
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
    expect(mockGetAuthenticatedUser).toHaveBeenCalledWith(storedToken.idToken);
  });

  it('clears auth state when a refresh invalidation is reported', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    const auth = await renderAuth();
    expect(auth().isAuthenticated).toBe(true);

    await act(async () => {
      if (!mockRefreshOutcomeUnknownListener) {
        throw new Error('Refresh invalidation listener was not registered.');
      }
      mockRefreshOutcomeUnknownListener();
      await flushPromises();
    });

    expect(auth().state).toBe('error');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
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

  it('ignores a startup token load that completes after sign-out', async () => {
    let resolveStartupToken!: (token: typeof storedToken) => void;
    mockLoadAccessToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStartupToken = resolve;
        }),
    );
    mockLoadAccessToken.mockResolvedValue(storedToken);

    const auth = await renderAuth();

    await act(async () => {
      await auth().signOut();
      await flushPromises();
    });
    await act(async () => {
      resolveStartupToken(storedToken);
      await flushPromises();
    });

    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled();
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().state).toBe('idle');
  });

  it('does not save a web token when sign-out beats startup refresh', async () => {
    setPlatformOs('web');
    let resolveStartupRefresh!: (token: typeof refreshedToken) => void;
    mockGetValidAccessToken.mockImplementationOnce(
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

  it('stops a protected action when the current session disappears', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    const auth = await renderAuth();
    const authenticatedAction = jest.fn(async () => undefined);
    mockGetValidAccessToken.mockResolvedValueOnce(null);

    let completed = true;
    await act(async () => {
      completed = await auth().callAuthenticatedEndpoint(authenticatedAction);
      await flushPromises();
    });

    expect(completed).toBe(false);
    expect(authenticatedAction).not.toHaveBeenCalled();
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().state).toBe('idle');
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

  it('does not retry startup profile failures in the auth hook', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    mockGetAuthenticatedUser.mockRejectedValueOnce(new Error('expired token'));

    const auth = await renderAuth();

    expect(mockGetValidAccessToken).not.toHaveBeenCalled();
    expect(auth().state).toBe('error');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
  });

  it('serializes foreground auth while the startup profile request is pending', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    let resolveStartupProfile!: (user: typeof authenticatedUser) => void;
    mockGetAuthenticatedUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStartupProfile = resolve;
        }),
    );

    const auth = await renderAuth();

    expect(auth().state).toBe('loading');
    let completed: boolean | undefined;
    await act(async () => {
      completed = await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(completed).toBe(false);
    expect(mockPromptAsync).not.toHaveBeenCalled();

    await act(async () => {
      resolveStartupProfile(authenticatedUser);
      await flushPromises();
    });

    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
  });

  it('does not start interactive web auth during delayed startup cookie refresh', async () => {
    setPlatformOs('web');
    let resolveStartupRefresh!: (token: typeof refreshedToken) => void;
    mockGetValidAccessToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStartupRefresh = resolve;
        }),
    );

    const auth = await renderAuth();

    expect(auth().state).toBe('loading');
    let completed: boolean | undefined;
    await act(async () => {
      completed = await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(completed).toBe(false);
    expect(mockGetValidAccessToken).toHaveBeenCalledWith({
      forceRefresh: true,
    });
    expect(mockPromptAsync).not.toHaveBeenCalled();

    await act(async () => {
      resolveStartupRefresh(refreshedToken);
      await flushPromises();
    });

    expect(mockSaveAccessToken).toHaveBeenCalledTimes(1);
    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
  });

  it('clears authenticated state when startup token refresh fails', async () => {
    mockLoadAccessToken.mockResolvedValue(storedToken);
    mockGetAuthenticatedUser.mockRejectedValue(new Error('invalid token'));

    const auth = await renderAuth();

    expect(auth().state).toBe('error');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
  });

  it('restores a web session by refreshing when no token is stored', async () => {
    setPlatformOs('web');
    mockGetValidAccessToken.mockResolvedValueOnce(refreshedToken);

    const auth = await renderAuth();

    expect(mockGetValidAccessToken).toHaveBeenCalledWith({
      forceRefresh: true,
    });
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
    mockGetValidAccessToken.mockResolvedValue(refreshedToken);
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

  it('stops a pending action when the session disappears after sign-in', async () => {
    mockGetValidAccessToken.mockResolvedValueOnce(null);
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

    expect(authenticatedAction).not.toHaveBeenCalled();
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().state).toBe('idle');
  });

  it('marks auth state as error when a pending action rejects', async () => {
    mockGetValidAccessToken.mockResolvedValue(refreshedToken);
    mockPromptResponse = {
      type: 'success',
      url: 'oauth-test-scheme://oauth/callback?code=auth-code&state=test-state',
      params: { code: 'auth-code', state: 'test-state' },
    };
    const auth = await renderAuth();
    const authenticatedAction = jest.fn(async () => {
      throw new Error('action failed');
    });

    await completePrompt(auth, mockPromptResponse, authenticatedAction);

    expect(authenticatedAction).toHaveBeenCalledWith(
      refreshedToken.accessToken,
    );
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().state).toBe('error');
  });

  it.each([
    ['missing code', undefined, 'test-state', 'test-code-verifier'],
    ['missing verifier', 'auth-code', 'test-state', undefined],
    ['missing state', 'auth-code', undefined, 'test-code-verifier'],
    ['mismatched state', 'auth-code', 'other-state', 'test-code-verifier'],
  ])(
    'rejects a callback with %s',
    async (_caseName, code, state, codeVerifier) => {
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
    },
  );

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

  it('reports discovery failures and retries OAuth setup', async () => {
    mockDiscoveryError = new Error('network request failed');
    const auth = await renderAuth();

    expect(auth().isReady).toBe(false);
    expect(auth().hasSetupError).toBe(true);
    expect(mockLogWarn).toHaveBeenCalledWith(
      'oauth_discovery_failed',
      expect.objectContaining({
        issuerUrl: 'https://identity.example.com',
      }),
    );

    await act(async () => {
      mockDiscoveryError = null;
      auth().retryAuthenticationSetup();
      await flushPromises();
    });

    expect(auth().isReady).toBe(true);
    expect(auth().hasSetupError).toBe(false);
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

    expect(mockGetAuthenticatedUser).toHaveBeenCalledWith(storedToken.idToken);
    expect(auth().state).toBe('success');
    expect(auth().user).toEqual(authenticatedUser);
  });

  it('clears the session when the shared profile request fails', async () => {
    mockLoadAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedToken);
    mockGetAuthenticatedUser.mockRejectedValueOnce(
      new AuthenticatedRequestError(401, 'expired token'),
    );
    const auth = await renderAuth();

    await act(async () => {
      await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(mockGetValidAccessToken).not.toHaveBeenCalled();
    expect(mockClearAuthenticatedSession).toHaveBeenCalled();
    expect(auth().state).toBe('error');
  });

  it.each([
    ['times out', new ApiRequestTimeoutError()],
    ['fails in transport', new TypeError('Network request failed.')],
    [
      'returns a server error',
      new AuthenticatedRequestError(503, 'Service unavailable.'),
    ],
  ])(
    'preserves the session when the profile request %s',
    async (_case, error) => {
      mockLoadAccessToken
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(storedToken);
      mockGetAuthenticatedUser.mockRejectedValueOnce(error);
      const auth = await renderAuth();

      await act(async () => {
        await auth().callAuthenticatedEndpoint();
        await flushPromises();
      });

      expect(mockClearAuthenticatedSession).not.toHaveBeenCalled();
      expect(auth().state).toBe('error');
      expect(auth().isAuthenticated).toBe(true);
    },
  );

  it('clears the session after a definitive refresh-token rejection', async () => {
    mockLoadAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedToken);
    mockGetAuthenticatedUser.mockRejectedValueOnce(
      new DefinitiveOAuthRejectionError(
        'invalid_grant',
        'The refresh token is invalid.',
      ),
    );
    const auth = await renderAuth();

    await act(async () => {
      await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(mockClearAuthenticatedSession).toHaveBeenCalled();
    expect(auth().isAuthenticated).toBe(false);
  });

  it('clears an invalid stored session when refresh is unavailable', async () => {
    setPlatformOs('web');
    mockDiscovery = null;
    mockLoadAccessToken.mockResolvedValue(storedToken);
    const auth = await renderAuth();

    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user).toEqual(authenticatedUser);
    mockGetAuthenticatedUser.mockRejectedValue(
      new AuthenticatedRequestError(401, 'request failed'),
    );

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
    mockGetValidAccessToken.mockResolvedValue(refreshedToken);
    const auth = await renderAuth();

    await act(async () => {
      await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(mockGetValidAccessToken).toHaveBeenCalledWith({
      forceRefresh: true,
    });
    expect(mockSaveAccessToken).toHaveBeenCalledWith(refreshedToken);
    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
  });

  it('starts sign-in when refreshing a web session fails', async () => {
    setPlatformOs('web');
    mockGetValidAccessToken.mockRejectedValue(new Error('no web session'));
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

  it('ignores duplicate auth requests while sign-in is pending', async () => {
    const auth = await renderAuth();
    let firstCompleted: boolean | undefined;
    let duplicateCompleted: boolean | undefined;

    await act(async () => {
      firstCompleted = await auth().callAuthenticatedEndpoint();
      duplicateCompleted = await auth().callAuthenticatedEndpoint();
      await flushPromises();
    });

    expect(firstCompleted).toBe(false);
    expect(duplicateCompleted).toBe(false);
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
    mockGetValidAccessToken.mockResolvedValue(refreshedToken);
    const auth = await renderAuth();

    await act(async () => {
      await auth().refreshAuthenticatedSession();
      await flushPromises();
    });

    expect(mockGetValidAccessToken).toHaveBeenCalledWith({
      forceRefresh: true,
    });
    expect(auth().state).toBe('success');
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user).toEqual(authenticatedUser);
  });

  it('rejects a session refresh when the refreshed token is missing', async () => {
    const auth = await renderAuth();
    mockLoadAccessToken.mockResolvedValueOnce(storedToken);
    mockGetValidAccessToken.mockResolvedValueOnce(null);

    await act(async () => {
      await expect(auth().refreshAuthenticatedSession()).rejects.toThrow(
        'No authenticated session is available to refresh.',
      );
    });

    expect(auth().state).toBe('error');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
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
    mockGetValidAccessToken.mockRejectedValue(new Error('refresh failed'));
    const auth = await renderAuth();

    await act(async () => {
      await expect(auth().refreshAuthenticatedSession()).rejects.toThrow(
        'refresh failed',
      );
    });

    expect(auth().state).toBe('error');
  });

  it('requires sign-in when a refresh outcome is unknown', async () => {
    mockLoadAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValue(storedToken);
    mockGetValidAccessToken.mockResolvedValue(refreshedToken);
    const auth = await renderAuth();

    await act(async () => {
      await auth().refreshAuthenticatedSession();
      await flushPromises();
    });
    expect(auth().isAuthenticated).toBe(true);

    mockGetValidAccessToken.mockRejectedValueOnce(
      new RefreshOutcomeUnknownError(),
    );
    await act(async () => {
      await expect(auth().refreshAuthenticatedSession()).rejects.toBeInstanceOf(
        RefreshOutcomeUnknownError,
      );
      await flushPromises();
    });

    expect(auth().state).toBe('error');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
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
      'oauth-test-scheme://oauth/logout',
      storedToken.idToken,
    );
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://identity.example.com/logout',
      'oauth-test-scheme://oauth/logout',
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
      'oauth-test-scheme://oauth/logout',
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
