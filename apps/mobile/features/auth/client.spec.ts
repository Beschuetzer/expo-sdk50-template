import {
  createIdentityProviderDiscovery,
  exchangeAuthorizationCode,
  exchangeAuthorizationCodeForCurrentPlatform,
  getAuthenticatedUser,
  revokeRefreshToken,
  refreshAccessToken,
  verifyAuthenticatedEndpointRejectsAnonymousRequest,
} from './client';

jest.mock('@/utils/helpers', () => ({
  getBackendUrl: jest.fn(() => 'http://localhost:4200'),
}));

jest.mock('@/utils/platform', () => ({
  getIdentityProviderUrl: jest.fn(() => 'https://identity-beta.adammajor.com'),
}));

function makeResponse(body: unknown, status: number): Response {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

describe('auth client', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });
  });

  it('builds identity-provider discovery endpoints', () => {
    expect(createIdentityProviderDiscovery()).toEqual({
      authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
      revocationEndpoint:
        'https://identity-beta.adammajor.com/token/revocation',
      tokenEndpoint: 'https://identity-beta.adammajor.com/token',
    });
  });

  it('revokes a native refresh token', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(makeResponse({}, 200));

    await expect(
      revokeRefreshToken('refresh-token', {
        authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
        revocationEndpoint:
          'https://identity-beta.adammajor.com/token/revocation',
        tokenEndpoint: 'https://identity-beta.adammajor.com/token',
      }),
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(
      'https://identity-beta.adammajor.com/token/revocation',
      {
        body: expect.stringContaining('token=refresh-token'),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      },
    );
  });

  it('does not call the identity provider to revoke a web session', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      revokeRefreshToken('refresh-token', {
        authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
        revocationEndpoint:
          'https://identity-beta.adammajor.com/token/revocation',
        tokenEndpoint: 'https://identity-beta.adammajor.com/token',
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the bearer token to the authenticated endpoint', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse({ claims: { sub: 'user-1' }, subject: 'user-1' }, 200),
      );

    await expect(getAuthenticatedUser('access-token')).resolves.toEqual({
      claims: { sub: 'user-1' },
      subject: 'user-1',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/v1/me', {
      headers: { Authorization: 'Bearer access-token' },
    });
  });

  it('uses the BFF cookie for web authenticated requests', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse({ claims: { sub: 'web-user' }, subject: 'web-user' }, 200),
      );

    await expect(getAuthenticatedUser('unused')).resolves.toEqual({
      claims: { sub: 'web-user' },
      subject: 'web-user',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/v1/me', {
      credentials: 'include',
    });
  });

  it('uses default claims and subject values when the response omits them', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(makeResponse({}, 200));

    await expect(getAuthenticatedUser('access-token')).resolves.toEqual({
      claims: {},
      subject: null,
    });
  });

  it('rejects authenticated endpoint errors', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse({ message: 'Authentication is required.' }, 401),
      );

    await expect(getAuthenticatedUser('expired-token')).rejects.toThrow(
      'Authentication is required.',
    );
  });

  it('exchanges an authorization code for a bearer token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse(
        {
          access_token: 'new-access-token',
          expires_in: 3600,
          scope: 'openid profile',
          token_type: 'Bearer',
        },
        200,
      ),
    );

    await expect(
      exchangeAuthorizationCode({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: {
          authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
          tokenEndpoint: 'https://identity-beta.adammajor.com/token',
        },
        redirectUri: 'exp://localhost:19000',
      }),
    ).resolves.toEqual({
      accessToken: 'new-access-token',
      expiresAt: expect.any(Number),
      scope: 'openid profile',
      tokenType: 'Bearer',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://identity-beta.adammajor.com/token',
      {
        body: expect.stringContaining('code=auth-code'),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      },
    );
  });

  it('uses the identity provider for native authorization-code exchange', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse(
        {
          access_token: 'native-access-token',
          expires_in: 900,
          refresh_token: 'native-refresh-token',
          token_type: 'Bearer',
        },
        200,
      ),
    );

    await expect(
      exchangeAuthorizationCodeForCurrentPlatform({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: {
          authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
          tokenEndpoint: 'https://identity-beta.adammajor.com/token',
        },
        redirectUri: 'exp://localhost:19000',
      }),
    ).resolves.toMatchObject({
      accessToken: 'native-access-token',
      refreshToken: 'native-refresh-token',
      tokenType: 'Bearer',
    });
  });

  it('rejects token exchange failures with the identity-provider error message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse(
        {
          error: 'invalid_grant',
          error_description: 'The code is expired.',
        },
        400,
      ),
    );

    await expect(
      exchangeAuthorizationCode({
        code: 'expired-code',
        codeVerifier: 'challenge',
        discovery: {
          authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
          tokenEndpoint: 'https://identity-beta.adammajor.com/token',
        },
        redirectUri: 'exp://localhost:19000',
      }),
    ).rejects.toThrow('The code is expired.');
  });

  it('uses the BFF for web authorization-code exchange', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse(
          { expires_in: 3600, scope: 'openid profile', token_type: 'Bearer' },
          200,
        ),
      );

    await expect(
      exchangeAuthorizationCodeForCurrentPlatform({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: {
          authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
        },
        redirectUri: 'http://localhost:8081/oauth/callback',
      }),
    ).resolves.toEqual({
      accessToken: '',
      expiresAt: expect.any(Number),
      scope: 'openid profile',
      tokenType: 'Bearer',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/auth/token', {
      body: expect.any(URLSearchParams),
      credentials: 'include',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
  });

  it('reports BFF exchange failures without an upstream description', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(makeResponse({}, 502));

    await expect(
      exchangeAuthorizationCodeForCurrentPlatform({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: {
          authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
        },
        redirectUri: 'http://localhost:8081/oauth/callback',
      }),
    ).rejects.toThrow('Token exchange failed with HTTP 502');
  });

  it('refreshes a native token and rotates its refresh token', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse(
        {
          access_token: 'refreshed-access-token',
          expires_in: 900,
          refresh_token: 'rotated-refresh-token',
          scope: 'openid profile',
          token_type: 'Bearer',
        },
        200,
      ),
    );

    await expect(
      refreshAccessToken(
        {
          accessToken: 'expired-access-token',
          expiresAt: Date.now() - 1,
          refreshToken: 'refresh-token',
          scope: 'openid profile',
          tokenType: 'Bearer',
        },
        {
          authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
          tokenEndpoint: 'https://identity-beta.adammajor.com/token',
        },
      ),
    ).resolves.toEqual({
      accessToken: 'refreshed-access-token',
      expiresAt: expect.any(Number),
      refreshToken: 'rotated-refresh-token',
      scope: 'openid profile',
      tokenType: 'Bearer',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://identity-beta.adammajor.com/token',
      {
        body: expect.stringContaining('grant_type=refresh_token'),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      },
    );
  });

  it('refreshes a web session through the BFF', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse({ expires_in: 900, token_type: 'Bearer' }, 200),
      );

    await expect(
      refreshAccessToken(
        {
          accessToken: '',
          expiresAt: Number.MAX_SAFE_INTEGER,
          scope: 'openid profile',
          tokenType: 'Bearer',
        },
        { authorizationEndpoint: 'https://identity-beta.adammajor.com/auth' },
      ),
    ).resolves.toEqual({
      accessToken: '',
      expiresAt: expect.any(Number),
      scope: 'openid profile',
      tokenType: 'Bearer',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/auth/refresh', {
      credentials: 'include',
      method: 'POST',
    });
  });

  it('preserves the previous web scope when refresh omits scope', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse({ expires_in: 900, token_type: 'Bearer' }, 200),
      );

    await expect(
      refreshAccessToken(
        {
          accessToken: '',
          expiresAt: Number.MAX_SAFE_INTEGER,
          scope: 'profile',
          tokenType: 'Bearer',
        },
        { authorizationEndpoint: 'https://identity-beta.adammajor.com/auth' },
      ),
    ).resolves.toMatchObject({ scope: 'profile' });
  });

  it('reports a BFF refresh error description', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse({ error_description: 'Refresh session expired.' }, 401),
      );

    await expect(
      refreshAccessToken(
        {
          accessToken: '',
          expiresAt: Number.MAX_SAFE_INTEGER,
          scope: 'profile',
          tokenType: 'Bearer',
        },
        { authorizationEndpoint: 'https://identity-beta.adammajor.com/auth' },
      ),
    ).rejects.toThrow('Refresh session expired.');
  });

  it('requires a native refresh token and token endpoint', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });

    await expect(
      refreshAccessToken(
        {
          accessToken: 'expired-access-token',
          expiresAt: Date.now() - 1,
          scope: 'profile',
          tokenType: 'Bearer',
        },
        { authorizationEndpoint: 'https://identity-beta.adammajor.com/auth' },
      ),
    ).rejects.toThrow('No refresh token is available.');
  });

  it('rejects native refresh when the provider returns an incomplete token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(makeResponse({}, 200));

    await expect(
      refreshAccessToken(
        {
          accessToken: 'expired-access-token',
          expiresAt: Date.now() - 1,
          refreshToken: 'refresh-token',
          scope: 'profile',
          tokenType: 'Bearer',
        },
        { tokenEndpoint: 'https://identity-beta.adammajor.com/token' },
      ),
    ).rejects.toThrow('Token refresh failed with HTTP 200');
  });

  it.each([
    ['NaN', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
    ['zero', 0],
  ])('rejects token exchange with %s expires_in', async (_label, expiresIn) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse(
        {
          access_token: 'access-token',
          expires_in: expiresIn,
          token_type: 'Bearer',
        },
        200,
      ),
    );

    await expect(
      exchangeAuthorizationCode({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: {
          tokenEndpoint: 'https://identity-beta.adammajor.com/token',
        },
        redirectUri: 'exp://localhost:19000',
      }),
    ).rejects.toThrow('Token exchange failed with HTTP 200');
  });

  it('rejects a token exchange with a non-bearer token type', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse(
          { access_token: 'access-token', expires_in: 3600, token_type: 'MAC' },
          200,
        ),
      );

    await expect(
      exchangeAuthorizationCode({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: {
          tokenEndpoint: 'https://identity-beta.adammajor.com/token',
        },
        redirectUri: 'exp://localhost:19000',
      }),
    ).rejects.toThrow('Token exchange failed with HTTP 200');
  });

  it('requires a token endpoint before exchanging codes', async () => {
    await expect(
      exchangeAuthorizationCode({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: {
          authorizationEndpoint: 'https://identity-beta.adammajor.com/auth',
        },
        redirectUri: 'exp://localhost:19000',
      }),
    ).rejects.toThrow(
      'The identity provider does not publish a token endpoint.',
    );
  });

  it('verifies anonymous requests are rejected with HTTP 401', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse({ status: 'unauthorized' }, 401));

    await expect(
      verifyAuthenticatedEndpointRejectsAnonymousRequest(),
    ).resolves.toBe(401);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/v1/me');
  });

  it('fails the security check when an anonymous request is accepted', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse({ status: 'ok' }, 200));

    await expect(
      verifyAuthenticatedEndpointRejectsAnonymousRequest(),
    ).rejects.toThrow('returned HTTP 200');
  });
});
