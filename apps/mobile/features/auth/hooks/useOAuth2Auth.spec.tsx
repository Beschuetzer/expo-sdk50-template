import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { useOAuth2AuthState } from './useOAuth2Auth';

const mockDiscovery = {
  authorizationEndpoint: 'https://identity.example.com/authorize',
  tokenEndpoint: 'https://identity.example.com/token',
};
let mockPromptResults: { type: 'cancel' }[] = [];
let mockNonceCounter = 0;
const mockPromptAsync = jest.fn(async () => mockPromptResults.shift());
const mockLoadAccessToken = jest.fn(async () => null);

jest.mock('expo-auth-session', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    CodeChallengeMethod: { S256: 'S256' },
    ResponseType: { Code: 'code' },
    makeRedirectUri: jest.fn(() => 'relationshipapp://oauth/callback'),
    useAutoDiscovery: () => mockDiscovery,
    useAuthRequest: (config: { extraParams: { nonce: string } }) => {
      const [response, setResponse] = React.useState<unknown>(null);
      const request = {
        codeVerifier: 'test-code-verifier',
        extraParams: config.extraParams,
        state: 'test-state',
        url: `https://identity.example.com/authorize?nonce=${config.extraParams.nonce}`,
      };
      const promptAsync = React.useCallback(async () => {
        const result = await mockPromptAsync();
        setResponse(result);
        return result;
      }, [request.url]);

      return [request, response, promptAsync];
    },
  };
});

jest.mock('expo-crypto', () => ({
  randomUUID: () => `test-nonce-${++mockNonceCounter}`,
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('../client', () => ({
  createProviderLogoutUrl: jest.fn(),
  exchangeAuthorizationCodeForCurrentPlatform: jest.fn(),
  getAuthenticatedUser: jest.fn(),
  MOBILE_OAUTH_AUDIENCE: 'test-audience',
  MOBILE_OAUTH_CLIENT_ID: 'test-client',
  MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI: '',
  MOBILE_OAUTH_SCHEME: 'relationshipapp',
  MOBILE_OAUTH_SCOPES: ['openid'],
  normalizeIdentityProviderDiscovery: (discovery: unknown) => discovery,
  refreshAccessToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
}));

jest.mock('../storage', () => ({
  clearAuthenticatedSession: jest.fn(),
  loadAccessToken: () => mockLoadAccessToken(),
  saveAccessToken: jest.fn(),
}));

jest.mock('@/utils/platform', () => ({
  getIdentityProviderUrl: () => 'https://identity.example.com',
}));

describe('useOAuth2AuthState', () => {
  beforeEach(() => {
    mockNonceCounter = 0;
    mockPromptResults = [{ type: 'cancel' }, { type: 'cancel' }];
    mockPromptAsync.mockClear();
    mockLoadAccessToken.mockResolvedValue(null);
  });

  it('clears authenticating state after repeated browser dismissals', async () => {
    let auth: ReturnType<typeof useOAuth2AuthState> | undefined;
    function TestConsumer() {
      auth = useOAuth2AuthState();
      return null;
    }

    await act(async () => {
      renderer.create(<TestConsumer />);
      await Promise.resolve();
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await act(async () => {
        await auth?.callAuthenticatedEndpoint();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(auth?.state).toBe('cancelled');
    }

    expect(mockPromptAsync).toHaveBeenCalledTimes(2);
  });
});
