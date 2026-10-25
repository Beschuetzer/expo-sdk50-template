import {
  exchangeAuthorizationCode,
  exchangeAuthorizationCodeForCurrentPlatform,
  createInvitationUrl,
  createProviderLogoutUrl,
  getAccountProviderFromClaims,
  getDisplayNameFromClaims,
  getAuthenticatedUser,
  getProfilePictureFromClaims,
  MOBILE_OAUTH_CLIENT_ID,
  MOBILE_OAUTH_SCHEME,
  MOBILE_OAUTH_SCOPES,
  normalizeIdentityProviderDiscovery,
  revokeRefreshToken,
  refreshAccessToken,
  verifyAuthenticatedEndpointRejectsAnonymousRequest,
} from './client';

jest.mock('@/utils/helpers', () => ({
  getBackendUrl: jest.fn(() => 'http://localhost:4200'),
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

  it('always requests offline access for refresh-token support', () => {
    expect(MOBILE_OAUTH_SCOPES).toContain('offline_access');
    expect(MOBILE_OAUTH_SCOPES).toEqual(
      expect.arrayContaining([
        'relationships:read',
        'relationships:create',
        'relationships:invite',
        'relationships:accept-invite',
        'payment-requests:read',
        'payment-requests:write',
      ]),
    );
  });

  it('accepts only HTTP profile picture claim URLs', () => {
    expect(
      getProfilePictureFromClaims({ picture: 'https://example.com/tom.jpg' }),
    ).toBe('https://example.com/tom.jpg');
    expect(
      getProfilePictureFromClaims({ picture: 'ftp://example.com/tom.jpg' }),
    ).toBe(undefined);
    expect(getProfilePictureFromClaims({})).toBeUndefined();
    expect(
      getProfilePictureFromClaims({ picture: 'not a URL' }),
    ).toBeUndefined();
  });

  it.each([
    ['apple', 'Apple'],
    ['discord', 'discord'],
    ['facebook', 'facebook'],
    ['github', 'github'],
    ['gitlab', 'gitlab'],
    ['google', 'google'],
    ['linkedin', 'linkedin'],
    ['microsoft', 'azure_ad'],
    ['x', 'Twitter'],
  ])('recognizes the %s identity provider', (provider, claimValue) => {
    expect(getAccountProviderFromClaims({ connection: claimValue })).toBe(
      provider,
    );
  });

  it('uses the first non-empty display-name claim', () => {
    expect(
      getDisplayNameFromClaims({
        name: '  ',
        preferred_username: '  morgan  ',
        email: 'morgan@example.com',
      }),
    ).toBe('morgan');
    expect(getDisplayNameFromClaims({})).toBeUndefined();
  });

  it('builds platform-appropriate invitation URLs', () => {
    expect(createInvitationUrl('invite code')).toBe(
      `${MOBILE_OAUTH_SCHEME}://invitation/invite%20code`,
    );

    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'https://app.example.com' } },
    });
    try {
      expect(createInvitationUrl('invite code')).toBe(
        'https://app.example.com/invitation/invite%20code',
      );
    } finally {
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalThis, 'window');
      } else {
        Object.defineProperty(globalThis, 'window', {
          configurable: true,
          value: originalWindow,
        });
      }
    }
  });

  it('maps known provider claims and uses Custom for unknown providers', () => {
    expect(getAccountProviderFromClaims({ connection: 'github-oauth' })).toBe(
      'github',
    );
    expect(getAccountProviderFromClaims({ connection: 'Git Hub' })).toBe(
      'github',
    );
    expect(getAccountProviderFromClaims({ connection: 'git_hub' })).toBe(
      'github',
    );
    expect(getAccountProviderFromClaims({ idp: 'Microsoft Entra ID' })).toBe(
      'microsoft',
    );
    expect(getAccountProviderFromClaims({ provider: 'company-sso' })).toBe(
      undefined,
    );
    expect(getAccountProviderFromClaims({})).toBeUndefined();
  });

  it('normalizes same-host discovery endpoints to the issuer protocol', () => {
    expect(
      normalizeIdentityProviderDiscovery(
        {
          authorizationEndpoint: 'http://localhost:4300/auth',
          revocationEndpoint: 'http://localhost:4300/token/revocation',
          tokenEndpoint: 'http://localhost:4300/token',
        },
        'https://localhost:4300',
      ),
    ).toEqual({
      authorizationEndpoint: 'https://localhost:4300/auth',
      revocationEndpoint: 'https://localhost:4300/token/revocation',
      tokenEndpoint: 'https://localhost:4300/token',
    });
  });

  it('preserves missing and malformed discovery endpoints', () => {
    expect(
      normalizeIdentityProviderDiscovery({}, 'https://identity.example.com'),
    ).toMatchObject({
      authorizationEndpoint: undefined,
      revocationEndpoint: undefined,
      tokenEndpoint: undefined,
    });
    expect(
      normalizeIdentityProviderDiscovery(
        { authorizationEndpoint: 'not a URL' },
        'https://identity.example.com',
      ).authorizationEndpoint,
    ).toBe('not a URL');
  });

  it.each([
    [
      'an HTTP issuer',
      'http://identity.example.com',
      'http://identity.example.com/token',
    ],
    [
      'an already-secure endpoint',
      'https://identity.example.com',
      'https://identity.example.com/token',
    ],
    [
      'a different endpoint host',
      'https://identity.example.com',
      'http://other.example.com/token',
    ],
  ])(
    'does not rewrite discovery URLs for %s',
    (_caseName, issuerUrl, endpoint) => {
      expect(
        normalizeIdentityProviderDiscovery(
          { tokenEndpoint: endpoint },
          issuerUrl,
        ).tokenEndpoint,
      ).toBe(endpoint);
    },
  );

  it('builds a provider logout URL with the registered redirect', () => {
    expect(
      createProviderLogoutUrl({}, 'expo50sdktemplate://logout'),
    ).toBeNull();
    expect(
      createProviderLogoutUrl(
        {
          endSessionEndpoint: 'http://localhost:4300/session/end',
        },
        'relationshipapp://oauth/callback',
      ),
    ).toBe(
      `http://localhost:4300/session/end?client_id=${encodeURIComponent(MOBILE_OAUTH_CLIENT_ID)}&post_logout_redirect_uri=relationshipapp%3A%2F%2Foauth%2Fcallback`,
    );
    expect(
      createProviderLogoutUrl(
        { endSessionEndpoint: 'http://localhost:4300/session/end' },
        'relationshipapp://oauth/callback',
        'id-token-hint',
      ),
    ).toContain('id_token_hint=id-token-hint');
  });

  it('revokes a native refresh token', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(makeResponse({}, 200));

    await expect(
      revokeRefreshToken('refresh-token', {
        authorizationEndpoint: 'http://localhost:4300/authorize',
        revocationEndpoint: 'http://localhost:4300/revoke',
        tokenEndpoint: 'http://localhost:4300/token',
      }),
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith('http://localhost:4300/revoke', {
      body: expect.stringContaining('token=refresh-token'),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
  });

  it('does not call the identity provider to revoke a web session', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      revokeRefreshToken('refresh-token', {
        authorizationEndpoint: 'http://localhost:4300/authorize',
        revocationEndpoint: 'http://localhost:4300/revoke',
        tokenEndpoint: 'http://localhost:4300/token',
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips native revocation when no revocation endpoint is published', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      revokeRefreshToken('refresh-token', {
        authorizationEndpoint: 'https://identity.example.com/authorize',
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports native revocation errors without a provider description', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(makeResponse({}, 503));

    await expect(
      revokeRefreshToken('refresh-token', {
        revocationEndpoint: 'https://identity.example.com/revoke',
      }),
    ).rejects.toThrow('Token revocation failed with HTTP 503');
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

  it('merges the ID token name when the API claims omit it', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse({ claims: { sub: 'user-1' }, subject: 'user-1' }, 200),
      );

    await expect(
      getAuthenticatedUser(
        'access-token',
        'eyJhbGciOiJub25lIn0.eyJuYW1lIjoiQWRhIExvdmVsYWNlIiwic3ViIjoiaWQtdXNlciJ9.signature',
      ),
    ).resolves.toEqual({
      claims: { name: 'Ada Lovelace', sub: 'user-1' },
      subject: 'user-1',
    });
  });

  it('uses the base64url fallback when the runtime has no atob', async () => {
    const originalAtob = globalThis.atob;
    Object.defineProperty(globalThis, 'atob', {
      configurable: true,
      value: undefined,
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse({ claims: { sub: 'api-user' } }, 200));

    try {
      const payload = Buffer.from(
        JSON.stringify({ name: 'Mina', sub: 'token-user' }),
      ).toString('base64url');
      await expect(
        getAuthenticatedUser('access-token', `header.${payload}.signature`),
      ).resolves.toEqual({
        claims: { name: 'Mina', sub: 'api-user' },
        subject: null,
      });
    } finally {
      Object.defineProperty(globalThis, 'atob', {
        configurable: true,
        value: originalAtob,
      });
    }
  });

  it('ignores malformed ID token payloads and keeps API claims', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse({ claims: { sub: 'api-user' } }, 200));

    await expect(
      getAuthenticatedUser('access-token', 'not-a-token'),
    ).resolves.toEqual({
      claims: { sub: 'api-user' },
      subject: null,
    });
  });

  it('ignores non-object ID token payloads and keeps API claims', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse({ claims: { sub: 'api-user' } }, 200));
    const primitivePayload = Buffer.from('null').toString('base64url');

    await expect(
      getAuthenticatedUser('access-token', `header.${primitivePayload}.sig`),
    ).resolves.toEqual({
      claims: { sub: 'api-user' },
      subject: null,
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

  it('uses the HTTP status when an authenticated endpoint error has no message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(makeResponse({}, 502));

    await expect(getAuthenticatedUser('access-token')).rejects.toThrow(
      'Authenticated request failed with HTTP 502',
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
          authorizationEndpoint: 'http://localhost:4300/authorize',
          tokenEndpoint: 'http://localhost:4300/token',
        },
        redirectUri: 'exp://localhost:19000',
      }),
    ).resolves.toEqual({
      accessToken: 'new-access-token',
      expiresAt: expect.any(Number),
      scope: 'openid profile',
      tokenType: 'Bearer',
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:4300/token', {
      body: expect.stringContaining('code=auth-code'),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
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
          id_token: 'native-id-token',
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
          authorizationEndpoint: 'http://localhost:4300/authorize',
          tokenEndpoint: 'http://localhost:4300/token',
        },
        redirectUri: 'exp://localhost:19000',
      }),
    ).resolves.toMatchObject({
      accessToken: 'native-access-token',
      idToken: 'native-id-token',
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
          authorizationEndpoint: 'http://localhost:4300/authorize',
          tokenEndpoint: 'http://localhost:4300/token',
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
          { expires_in: 3600, scope: 'openid api:read', token_type: 'Bearer' },
          200,
        ),
      );

    await expect(
      exchangeAuthorizationCodeForCurrentPlatform({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: { authorizationEndpoint: 'http://localhost:4300/authorize' },
        redirectUri: 'http://localhost:8081/oauth/callback',
      }),
    ).resolves.toEqual({
      accessToken: '',
      expiresAt: expect.any(Number),
      scope: 'openid api:read',
      tokenType: 'Bearer',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/auth/token', {
      body: expect.any(URLSearchParams),
      credentials: 'include',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
  });

  it('refreshes a web session from its BFF cookie', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'web' },
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        makeResponse(
          { expires_in: 3600, scope: 'openid api:read', token_type: 'Bearer' },
          200,
        ),
      );

    await expect(
      refreshAccessToken(undefined, {
        authorizationEndpoint: 'http://localhost:4300/authorize',
      }),
    ).resolves.toMatchObject({
      accessToken: '',
      scope: 'openid api:read',
      tokenType: 'Bearer',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/auth/refresh', {
      credentials: 'include',
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
        discovery: { authorizationEndpoint: 'http://localhost:4300/authorize' },
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
          scope: 'openid api:read',
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
          scope: 'openid api:read',
          tokenType: 'Bearer',
        },
        {
          authorizationEndpoint: 'http://localhost:4300/authorize',
          tokenEndpoint: 'http://localhost:4300/token',
        },
      ),
    ).resolves.toEqual({
      accessToken: 'refreshed-access-token',
      expiresAt: expect.any(Number),
      refreshToken: 'rotated-refresh-token',
      scope: 'openid api:read',
      tokenType: 'Bearer',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost:4300/token', {
      body: expect.stringContaining('grant_type=refresh_token'),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
  });

  it('preserves a native refresh token when the provider does not rotate it', async () => {
    Object.defineProperty(require('react-native'), 'Platform', {
      configurable: true,
      value: { OS: 'android' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse(
        {
          access_token: 'refreshed-access-token',
          expires_in: 900,
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
          refreshToken: 'existing-refresh-token',
          scope: 'openid offline_access orders.read',
          tokenType: 'Bearer',
        },
        { tokenEndpoint: 'http://localhost:4300/token' },
      ),
    ).resolves.toMatchObject({
      accessToken: 'refreshed-access-token',
      refreshToken: 'existing-refresh-token',
    });
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
          scope: 'openid api:read',
          tokenType: 'Bearer',
        },
        { authorizationEndpoint: 'http://localhost:4300/authorize' },
      ),
    ).resolves.toEqual({
      accessToken: '',
      expiresAt: expect.any(Number),
      scope: 'openid api:read',
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
          scope: 'api:read',
          tokenType: 'Bearer',
        },
        { authorizationEndpoint: 'http://localhost:4300/authorize' },
      ),
    ).resolves.toMatchObject({ scope: 'api:read' });
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
          scope: 'api:read',
          tokenType: 'Bearer',
        },
        { authorizationEndpoint: 'http://localhost:4300/authorize' },
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
          scope: 'api:read',
          tokenType: 'Bearer',
        },
        { authorizationEndpoint: 'http://localhost:4300/authorize' },
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
          scope: 'api:read',
          tokenType: 'Bearer',
        },
        { tokenEndpoint: 'http://localhost:4300/token' },
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
        discovery: { tokenEndpoint: 'http://localhost:4300/token' },
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
        discovery: { tokenEndpoint: 'http://localhost:4300/token' },
        redirectUri: 'exp://localhost:19000',
      }),
    ).rejects.toThrow('Token exchange failed with HTTP 200');
  });

  it('requires a token endpoint before exchanging codes', async () => {
    await expect(
      exchangeAuthorizationCode({
        code: 'auth-code',
        codeVerifier: 'challenge',
        discovery: { authorizationEndpoint: 'http://localhost:4300/authorize' },
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
