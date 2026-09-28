import express, { type Express, type Request, type Response } from 'express';

import type { IdentityProviderConfig } from './config/env';
import type {
  AuthorizationCodeStore,
  ClientStore,
  OAuthClient,
  RefreshTokenStore,
  UserStore,
} from './domain/types';
import {
  createOpaqueValue,
  createCodeChallenge,
  TokenService,
} from './security/tokens';

export type IdentityProviderStores = {
  clientStore: ClientStore;
  userStore: UserStore;
  authorizationCodeStore: AuthorizationCodeStore;
  refreshTokenStore: RefreshTokenStore;
};

function oauthError(
  response: Response,
  error: string,
  description: string,
  status = 400,
) {
  response.status(status).json({ error, error_description: description });
}

function getClientCredentials(request: Request) {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Basic ')) {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString(
      'utf8',
    );
    const separator = decoded.indexOf(':');
    if (separator >= 0) {
      return {
        clientId: decoded.slice(0, separator),
        clientSecret: decoded.slice(separator + 1),
      };
    }
  }
  return {
    clientId:
      typeof request.body.client_id === 'string'
        ? request.body.client_id
        : undefined,
    clientSecret:
      typeof request.body.client_secret === 'string'
        ? request.body.client_secret
        : undefined,
  };
}

function isValidRedirect(client: OAuthClient, redirectUri: unknown) {
  return (
    typeof redirectUri === 'string' && client.redirectUris.includes(redirectUri)
  );
}

function renderLogin(parameters: Record<string, string>) {
  const hidden = Object.entries(parameters)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${key}" value="${value.replace(/"/g, '&quot;')}">`,
    )
    .join('');
  return `<!doctype html><html><body><h1>Sign in</h1><form method="post" action="/authorize">${hidden}<label>Username <input name="username" type="email" autocomplete="username"></label><label>Password <input name="password" type="password" autocomplete="current-password"></label><button type="submit">Continue</button></form></body></html>`;
}

export function createApp(
  config: IdentityProviderConfig,
  stores: IdentityProviderStores,
  tokenService: TokenService,
): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get('/.well-known/openid-configuration', (_request, response) => {
    response.json({
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/authorize`,
      token_endpoint: `${config.issuer}/token`,
      jwks_uri: `${config.issuer}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: [
        'authorization_code',
        'client_credentials',
        'refresh_token',
      ],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: [
        'none',
        'client_secret_basic',
        'client_secret_post',
      ],
      revocation_endpoint: `${config.issuer}/revoke`,
    });
  });

  app.get('/.well-known/jwks.json', async (_request, response, next) => {
    try {
      response.json(await tokenService.getJwks());
    } catch (error) {
      next(error);
    }
  });

  app.get('/authorize', (request, response) => {
    const parameters = Object.fromEntries(
      Object.entries(request.query).map(([key, value]) => [key, String(value)]),
    );
    const {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope = '',
    } = parameters;
    const client = clientId ? stores.clientStore.findById(clientId) : undefined;
    if (!client || !client.allowedGrantTypes.includes('authorization_code'))
      return oauthError(
        response,
        'unauthorized_client',
        'Unknown or unauthorized client.',
        401,
      );
    if (responseType !== 'code' || !isValidRedirect(client, redirectUri))
      return oauthError(
        response,
        'invalid_request',
        'A valid code response type and registered redirect URI are required.',
      );
    if (!codeChallenge || codeChallengeMethod !== 'S256')
      return oauthError(
        response,
        'invalid_request',
        'Authorization Code with PKCE requires an S256 code challenge.',
      );
    response.type('html').send(
      renderLogin({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        state: parameters.state ?? '',
      }),
    );
  });

  app.post('/authorize', (request, response) => {
    const {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      scope = '',
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      state = '',
      username,
      password,
    } = request.body as Record<string, string>;
    const client = clientId ? stores.clientStore.findById(clientId) : undefined;
    const user =
      username && password
        ? stores.userStore.authenticate(username, password)
        : undefined;
    if (
      !client ||
      !user ||
      responseType !== 'code' ||
      !isValidRedirect(client, redirectUri) ||
      !codeChallenge ||
      codeChallengeMethod !== 'S256'
    )
      return oauthError(
        response,
        'access_denied',
        'The authorization request could not be completed.',
      );
    const requestedScopes = scope.split(' ').filter(Boolean);
    if (requestedScopes.some((value) => !client.allowedScopes.includes(value)))
      return oauthError(
        response,
        'invalid_scope',
        'The requested scope is not allowed.',
      );
    const code = createOpaqueValue();
    stores.authorizationCodeStore.save({
      code,
      clientId,
      userId: user.id,
      redirectUri,
      scope: requestedScopes.join(' '),
      codeChallenge,
      codeChallengeMethod: 'S256',
      expiresAt: Date.now() + config.authorizationCodeLifetimeSeconds * 1000,
    });
    const location = new URL(redirectUri);
    location.searchParams.set('code', code);
    if (state) location.searchParams.set('state', state);
    response.redirect(location.toString());
  });

  app.post('/token', async (request, response, next) => {
    try {
      const grantType = request.body.grant_type;
      const credentials = getClientCredentials(request);
      const client = credentials.clientId
        ? stores.clientStore.findById(credentials.clientId)
        : undefined;
      if (!client) {
        return oauthError(
          response,
          'invalid_client',
          'Client authentication failed.',
          401,
        );
      }
      if (
        client.clientSecret &&
        client.clientSecret !== credentials.clientSecret
      ) {
        return oauthError(
          response,
          'invalid_client',
          'Client authentication failed.',
          401,
        );
      }
      if (grantType === 'client_credentials') {
        if (
          !client.clientSecret ||
          client.clientSecret !== credentials.clientSecret ||
          !client.allowedGrantTypes.includes('client_credentials')
        ) {
          return oauthError(
            response,
            'unauthorized_client',
            'Client credentials grant is not allowed.',
            401,
          );
        }
        const scope = String(request.body.scope ?? '')
          .split(' ')
          .filter(Boolean);
        if (scope.some((value) => !client.allowedScopes.includes(value)))
          return oauthError(
            response,
            'invalid_scope',
            'The requested scope is not allowed.',
          );
        const accessToken = await tokenService.createAccessToken(
          { id: client.clientId },
          client.clientId,
          scope.join(' '),
        );
        return response.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: config.accessTokenLifetimeSeconds,
          scope: scope.join(' '),
        });
      }
      if (grantType === 'refresh_token') {
        if (!client.allowedGrantTypes.includes('refresh_token')) {
          return oauthError(
            response,
            'unauthorized_client',
            'Refresh tokens are not allowed for this client.',
            401,
          );
        }
        const previousToken = stores.refreshTokenStore.consume(
          String(request.body.refresh_token),
        );
        if (!previousToken || previousToken.expiresAt <= Date.now()) {
          return oauthError(
            response,
            'invalid_grant',
            'The refresh token is invalid or expired.',
          );
        }
        if (previousToken.clientId !== client.clientId) {
          return oauthError(
            response,
            'invalid_grant',
            'The refresh token was not issued to this client.',
          );
        }
        const user = stores.userStore.findById(previousToken.userId);
        if (!user) {
          return oauthError(
            response,
            'invalid_grant',
            'The authorization subject no longer exists.',
          );
        }
        const accessToken = await tokenService.createAccessToken(
          user,
          client.clientId,
          previousToken.scope,
        );
        const refreshToken = createOpaqueValue();
        stores.refreshTokenStore.save({
          token: refreshToken,
          clientId: client.clientId,
          userId: user.id,
          scope: previousToken.scope,
          expiresAt: Date.now() + config.refreshTokenLifetimeSeconds * 1000,
        });
        return response.json({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: config.accessTokenLifetimeSeconds,
          scope: previousToken.scope,
        });
      }
      if (
        grantType !== 'authorization_code' ||
        !client.allowedGrantTypes.includes('authorization_code')
      )
        return oauthError(
          response,
          'unsupported_grant_type',
          'Only authorization_code and client_credentials are supported.',
        );
      const code = stores.authorizationCodeStore.consume(
        String(request.body.code),
      );
      if (
        !code ||
        code.clientId !== client.clientId ||
        code.redirectUri !== request.body.redirect_uri ||
        code.expiresAt <= Date.now() ||
        createCodeChallenge(String(request.body.code_verifier)) !==
          code.codeChallenge
      )
        return oauthError(
          response,
          'invalid_grant',
          'The authorization code or PKCE verifier is invalid.',
        );
      const user = stores.userStore.findById(code.userId);
      if (!user)
        return oauthError(
          response,
          'invalid_grant',
          'The authorization subject no longer exists.',
        );
      const accessToken = await tokenService.createAccessToken(
        user,
        client.clientId,
        code.scope,
      );
      const refreshToken = createOpaqueValue();
      stores.refreshTokenStore.save({
        token: refreshToken,
        clientId: client.clientId,
        userId: user.id,
        scope: code.scope,
        expiresAt: Date.now() + config.refreshTokenLifetimeSeconds * 1000,
      });
      return response.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: config.accessTokenLifetimeSeconds,
        scope: code.scope,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/revoke', (request, response) => {
    const credentials = getClientCredentials(request);
    const client = credentials.clientId
      ? stores.clientStore.findById(credentials.clientId)
      : undefined;
    if (!client) {
      return oauthError(
        response,
        'invalid_client',
        'Client authentication failed.',
        401,
      );
    }
    if (
      client.clientSecret &&
      client.clientSecret !== credentials.clientSecret
    ) {
      return oauthError(
        response,
        'invalid_client',
        'Client authentication failed.',
        401,
      );
    }

    const token =
      typeof request.body.token === 'string' ? request.body.token : undefined;
    if (!token) {
      return oauthError(response, 'invalid_request', 'A token is required.');
    }

    stores.refreshTokenStore.revoke(token);
    return response.status(200).end();
  });

  app.use((_request, response) =>
    response.status(404).json({ error: 'not_found' }),
  );
  app.use(
    (error: unknown, _request: Request, response: Response, _next: unknown) => {
      console.error(error);
      response.status(500).json({ error: 'server_error' });
    },
  );
  return app;
}
