import type { RequestHandler } from 'express';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { createApp } from './app';
import { loadConfig } from './config/env';

const listen = promisify(
  (server: ReturnType<typeof createServer>, callback: () => void) =>
    server.listen(0, '127.0.0.1', callback),
);
const TEST_AUTH_CLIENT_ID = 'test-client-id';

function loadTestConfig(environment: NodeJS.ProcessEnv = {}) {
  return loadConfig({ AUTH_CLIENT_ID: TEST_AUTH_CLIENT_ID, ...environment });
}

function get(
  server: ReturnType<typeof createServer>,
  path: string,
  headers: Record<string, string> = {},
) {
  const address = server.address();
  assert(address && typeof address !== 'string');

  return new Promise<{
    body: Record<string, string>;
    requestId?: string;
    statusCode: number;
  }>((resolve, reject) => {
    const response = request(
      {
        headers,
        hostname: '127.0.0.1',
        path,
        port: address.port,
      },
      (incomingResponse) => {
        let body = '';
        incomingResponse.setEncoding('utf8');
        incomingResponse.on('data', (chunk) => (body += chunk));
        incomingResponse.on('end', () => {
          resolve({
            body: JSON.parse(body) as Record<string, string>,
            requestId:
              typeof incomingResponse.headers['x-request-id'] === 'string'
                ? incomingResponse.headers['x-request-id']
                : undefined,
            statusCode: incomingResponse.statusCode ?? 0,
          });
        });
      },
    );
    response.on('error', reject);
    response.end();
  });
}

function postRaw(
  server: ReturnType<typeof createServer>,
  path: string,
  body: string,
) {
  const address = server.address();
  assert(address && typeof address !== 'string');

  return new Promise<{ body: Record<string, string>; statusCode: number }>(
    (resolve, reject) => {
      const response = request(
        {
          headers: { 'content-type': 'application/json' },
          hostname: '127.0.0.1',
          method: 'POST',
          path,
          port: address.port,
        },
        (incomingResponse) => {
          let responseBody = '';
          incomingResponse.setEncoding('utf8');
          incomingResponse.on('data', (chunk) => (responseBody += chunk));
          incomingResponse.on('end', () => {
            resolve({
              body: JSON.parse(responseBody) as Record<string, string>,
              statusCode: incomingResponse.statusCode ?? 0,
            });
          });
        },
      );
      response.on('error', reject);
      response.end(body);
    },
  );
}

test('GET /health returns an API health response', async (t) => {
  const server = createServer(createApp(loadTestConfig()));
  await listen(server);
  t.after(() => server.close());

  const response = await get(server, '/health?verbose=true');

  assert.equal(response.statusCode, 200);
  assert.ok(response.requestId);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.service, 'api');
  assert.ok(response.body.timestamp);
});

test('requests propagate an existing request ID', async (t) => {
  const server = createServer(createApp(loadTestConfig()));
  await listen(server);
  t.after(() => server.close());

  const response = await get(server, '/health', {
    'x-request-id': 'request-123',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.requestId, 'request-123');
});

test('GET /health reports database degradation', async (t) => {
  const server = createServer(
    createApp(loadTestConfig({ DATABASE_URL: 'mongodb://database' }), {
      databaseHealth: {
        $runCommandRaw: async () => {
          throw new Error('database unavailable');
        },
      },
    }),
  );
  await listen(server);
  t.after(() => server.close());

  const response = await get(server, '/health');

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.status, 'degraded');
  assert.equal(response.body.error, undefined);
});

test('unknown routes return a not found response', async (t) => {
  const server = createServer(createApp(loadTestConfig()));
  await listen(server);
  t.after(() => server.close());

  const response = await get(server, '/unknown');

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.status, 'not_found');
});

test('protected routes require OAuth2 configuration by default', async (t) => {
  const server = createServer(createApp(loadTestConfig()));
  await listen(server);
  t.after(() => server.close());

  const response = await get(server, '/api/v1/me');

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.status, 'auth_not_configured');
});

test('protected routes reject an anonymous request with HTTP 401', async (t) => {
  const server = createServer(
    createApp(
      loadTestConfig({
        AUTH_AUDIENCE: 'api',
        AUTH_ISSUER_BASE_URL: 'https://identity.example.com',
      }),
    ),
  );
  await listen(server);
  t.after(() => server.close());

  const response = await get(server, '/api/v1/me');

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.status, 'unauthorized');
});

for (const [name, errorMessage] of [
  ['invalid JWTs', 'Invalid token'],
  ['expired JWTs', 'Token expired'],
] as const) {
  test(`protected routes reject ${name}`, async (t) => {
    const rejected: RequestHandler = (_request, _response, next) => {
      const error = Object.assign(new Error(errorMessage), { statusCode: 401 });
      next(error);
    };
    const server = createServer(
      createApp(loadTestConfig(), { authMiddleware: rejected }),
    );
    await listen(server);
    t.after(() => server.close());

    const response = await get(server, '/api/v1/me');

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.status, 'unauthorized');
    assert.equal(response.body.message, 'Authentication is required.');
  });
}

test('protected routes reject requests missing required scopes', async (t) => {
  const rejected: RequestHandler = (_request, _response, next) => {
    next(Object.assign(new Error('Insufficient scope'), { statusCode: 403 }));
  };
  const server = createServer(
    createApp(loadTestConfig(), { authMiddleware: rejected }),
  );
  await listen(server);
  t.after(() => server.close());

  const response = await get(server, '/api/v1/me');

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.status, 'forbidden');
  assert.equal(response.body.message, 'Forbidden.');
});

test('malformed JSON returns a bad request response', async (t) => {
  const server = createServer(createApp(loadTestConfig()));
  await listen(server);
  t.after(() => server.close());

  const response = await postRaw(server, '/auth/token', '{malformed');

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.status, 'bad_request');
});

test('protected routes can use an injected authentication adapter', async (t) => {
  const authenticated: RequestHandler = (request, _response, next) => {
    request.auth = {
      header: {},
      payload: { sub: 'user-123' },
      token: 'test-token',
    };
    next();
  };
  const server = createServer(
    createApp(loadTestConfig(), { authMiddleware: authenticated }),
  );
  await listen(server);
  t.after(() => server.close());

  const response = await get(server, '/api/v1/me');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.subject, 'user-123');
});

test('configuration uses defaults and validates the port', () => {
  assert.deepEqual(loadTestConfig(), {
    environment: 'development',
    host: '0.0.0.0',
    port: 4200,
    databaseUrl: undefined,
    oauthClientId: TEST_AUTH_CLIENT_ID,
    corsOrigin: 'http://localhost:8081',
    oauth2: {
      issuerBaseUrl: undefined,
      audience: undefined,
      requiredScopes: [],
    },
  });
  assert.throws(
    () => loadTestConfig({ PORT: 'invalid' }),
    /PORT must be an integer/,
  );
});

test('configuration requires an OAuth client ID', () => {
  assert.throws(() => loadConfig({}), /AUTH_CLIENT_ID must be set/);
});

test('configuration uses the configured OAuth client ID', () => {
  const config = loadTestConfig({ AUTH_CLIENT_ID: 'registered-client' });

  assert.equal(config.oauthClientId, 'registered-client');
});

test('configuration normalizes the OAuth issuer URL', () => {
  const config = loadTestConfig({
    AUTH_ISSUER_BASE_URL: 'https://identity.example.com///',
  });

  assert.equal(config.oauth2.issuerBaseUrl, 'https://identity.example.com');
});
