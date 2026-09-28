import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { createApp, type IdentityProviderStores } from './app';
import { loadConfig } from './config/env';
import { createDevelopmentStores } from './infrastructure/memory';
import { createCodeChallenge, TokenService } from './security/tokens';

const listen = promisify(
  (server: ReturnType<typeof createServer>, callback: () => void) =>
    server.listen(0, '127.0.0.1', callback),
);

function call(
  server: ReturnType<typeof createServer>,
  options: {
    method?: string;
    path: string;
    body?: string;
    headers?: Record<string, string>;
  },
) {
  const address = server.address();
  assert(address && typeof address !== 'string');
  return new Promise<{
    body: any;
    headers: Record<string, string | string[] | undefined>;
    statusCode: number;
  }>((resolve, reject) => {
    const response = request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        method: options.method ?? 'GET',
        path: options.path,
        headers: options.headers,
      },
      (incomingResponse) => {
        let body = '';
        incomingResponse.setEncoding('utf8');
        incomingResponse.on('data', (chunk) => (body += chunk));
        incomingResponse.on('end', () => {
          resolve({
            body:
              body && incomingResponse.headers['content-type']?.includes('json')
                ? JSON.parse(body)
                : body,
            headers: incomingResponse.headers,
            statusCode: incomingResponse.statusCode ?? 0,
          });
        });
      },
    );
    response.on('error', reject);
    response.end(options.body);
  });
}

function form(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

test('refuses production mode', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production' }),
    /identity provider is development-only/i,
  );
});

async function createTestServer(
  stores: IdentityProviderStores = createDevelopmentStores(),
) {
  const config = loadConfig({ IDP_ISSUER: 'http://127.0.0.1:4300' });
  const server = createServer(
    createApp(config, stores, new TokenService(config)),
  );
  await listen(server);
  return server;
}

test('publishes OAuth2 discovery and JWKS metadata', async (t) => {
  const server = await createTestServer();
  t.after(() => server.close());

  const discovery = await call(server, {
    path: '/.well-known/openid-configuration',
  });
  const jwks = await call(server, { path: '/.well-known/jwks.json' });

  assert.equal(discovery.statusCode, 200);
  assert.deepEqual(discovery.body.grant_types_supported, [
    'authorization_code',
    'client_credentials',
    'refresh_token',
  ]);
  assert.equal(
    discovery.body.revocation_endpoint,
    'http://127.0.0.1:4300/revoke',
  );
  assert.deepEqual(discovery.body.token_endpoint_auth_methods_supported, [
    'none',
    'client_secret_basic',
    'client_secret_post',
  ]);
  assert.equal(jwks.statusCode, 200);
  assert.equal(jwks.body.keys[0].alg, 'RS256');
});

test('supports authorization code with PKCE S256', async (t) => {
  const server = await createTestServer();
  t.after(() => server.close());
  const verifier = 'a'.repeat(43);
  const codeChallenge = createCodeChallenge(verifier);
  const query = new URLSearchParams({
    client_id: 'mobile-development-client',
    redirect_uri: 'http://localhost:8081/oauth/callback',
    response_type: 'code',
    scope: 'openid api:read',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: 'state-123',
  });

  const login = await call(server, { path: `/authorize?${query}` });
  assert.equal(login.statusCode, 200);
  const authorization = await call(server, {
    method: 'POST',
    path: '/authorize',
    body: form({
      ...Object.fromEntries(query),
      username: 'test@test.com',
      password: 'test',
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(authorization.statusCode, 302);
  const location = new URL(String(authorization.headers.location));
  const token = await call(server, {
    method: 'POST',
    path: '/token',
    body: form({
      grant_type: 'authorization_code',
      client_id: 'mobile-development-client',
      code: location.searchParams.get('code') ?? '',
      redirect_uri: 'http://localhost:8081/oauth/callback',
      code_verifier: verifier,
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(token.statusCode, 200);
  assert.equal(token.body.token_type, 'Bearer');
  assert.equal(typeof token.body.refresh_token, 'string');

  const refreshed = await call(server, {
    method: 'POST',
    path: '/token',
    body: form({
      grant_type: 'refresh_token',
      client_id: 'mobile-development-client',
      refresh_token: token.body.refresh_token,
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(refreshed.statusCode, 200);
  assert.equal(refreshed.body.token_type, 'Bearer');
  assert.notEqual(refreshed.body.refresh_token, token.body.refresh_token);

  const revoked = await call(server, {
    method: 'POST',
    path: '/revoke',
    body: form({
      client_id: 'mobile-development-client',
      token: refreshed.body.refresh_token,
      token_type_hint: 'refresh_token',
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(revoked.statusCode, 200);

  const revokedRefresh = await call(server, {
    method: 'POST',
    path: '/token',
    body: form({
      grant_type: 'refresh_token',
      client_id: 'mobile-development-client',
      refresh_token: refreshed.body.refresh_token,
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(revokedRefresh.statusCode, 400);
  assert.equal(revokedRefresh.body.error, 'invalid_grant');

  const replay = await call(server, {
    method: 'POST',
    path: '/token',
    body: form({
      grant_type: 'refresh_token',
      client_id: 'mobile-development-client',
      refresh_token: token.body.refresh_token,
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(replay.statusCode, 400);
  assert.equal(replay.body.error, 'invalid_grant');
});

test('supports client credentials with confidential client authentication', async (t) => {
  const server = await createTestServer();
  t.after(() => server.close());

  const token = await call(server, {
    method: 'POST',
    path: '/token',
    body: form({ grant_type: 'client_credentials', scope: 'api:read' }),
    headers: {
      authorization: `Basic ${Buffer.from('api-development-client:api-development-secret').toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
  });

  assert.equal(token.statusCode, 200);
  assert.equal(token.body.token_type, 'Bearer');
});

test('requires confidential clients to authenticate authorization-code exchanges', async (t) => {
  const server = await createTestServer();
  t.after(() => server.close());

  const response = await call(server, {
    method: 'POST',
    path: '/token',
    body: form({
      grant_type: 'authorization_code',
      client_id: 'api-development-client',
      code: 'not-a-real-code',
      code_verifier: 'a'.repeat(43),
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'invalid_client');
});
