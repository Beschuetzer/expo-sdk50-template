export interface ApiConfig {
  environment: string;
  host: string;
  port: number;
  databaseUrl?: string;
  oauthClientId: string;
  corsOrigin: string;
  oauth2: {
    issuerBaseUrl?: string;
    audience?: string;
    requiredScopes: string[];
  };
}

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 4200;
const DEFAULT_OAUTH_CLIENT_ID = 'mobile-development-client';
const DEFAULT_CORS_ORIGIN = 'http://localhost:8081';

function parsePort(value: string | undefined) {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  const requiredScopes = (environment.AUTH_REQUIRED_SCOPES ?? '')
    .split(/[ ,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return {
    environment: environment.NODE_ENV ?? 'development',
    host: environment.HOST?.trim() || DEFAULT_HOST,
    port: parsePort(environment.PORT),
    databaseUrl: environment.DATABASE_URL?.trim() || undefined,
    oauthClientId:
      environment.AUTH_CLIENT_ID?.trim() || DEFAULT_OAUTH_CLIENT_ID,
    corsOrigin: environment.CORS_ORIGIN?.trim() || DEFAULT_CORS_ORIGIN,
    oauth2: {
      issuerBaseUrl:
        environment.AUTH_ISSUER_BASE_URL?.trim().replace(/\/+$/, '') ||
        undefined,
      audience: environment.AUTH_AUDIENCE?.trim() || undefined,
      requiredScopes,
    },
  };
}
