import type { DiscoveryDocument } from 'expo-auth-session';
import { Platform } from 'react-native';

import { DefinitiveOAuthRejectionError } from './errors';
import type { StoredAccessToken } from './storage';

import { getBackendUrl } from '@/utils/helpers';

export const MOBILE_OAUTH_CLIENT_ID =
  process.env.EXPO_PUBLIC_OAUTH_CLIENT_ID?.trim() ?? '';
const configuredIdentityProviderUrl =
  process.env.EXPO_PUBLIC_IDP_URL?.trim().replace(/\/$/, '');
export const MOBILE_OAUTH_AUDIENCE =
  process.env.EXPO_PUBLIC_OAUTH_AUDIENCE?.trim() ||
  (configuredIdentityProviderUrl
    ? `${configuredIdentityProviderUrl}/resources/api`
    : '');
const configuredOAuthScopes = (
  process.env.EXPO_PUBLIC_OAUTH_SCOPES?.trim() ||
  'openid profile email offline_access relationships:read relationships:create relationships:invite relationships:accept-invite payment-requests:read payment-requests:write'
)
  .split(/[ ,]+/)
  .filter(Boolean);
export const MOBILE_OAUTH_SCOPES = Array.from(
  new Set([...configuredOAuthScopes, 'offline_access']),
);
export const MOBILE_OAUTH_SCHEME =
  process.env.EXPO_PUBLIC_OAUTH_SCHEME?.trim() || 'expo50sdktemplate';
export const MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI =
  process.env.EXPO_PUBLIC_OAUTH_POST_LOGOUT_REDIRECT_URI?.trim();

export function createInvitationUrl(token: string) {
  const encodedToken = encodeURIComponent(token);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/invitation/${encodedToken}`;
  }
  return `${MOBILE_OAUTH_SCHEME}://invitation/${encodedToken}`;
}

type TokenResponse = {
  access_token?: unknown;
  id_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
  status?: unknown;
};

const DEFINITIVE_OAUTH_REJECTION_CODES = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope',
]);

function getTokenResponseField(
  result: unknown,
  field: keyof TokenResponse,
): unknown {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    return undefined;
  }
  return (result as TokenResponse)[field];
}

function getDefinitiveOAuthRejectionCode(
  response: Response,
  result: unknown,
): string | undefined {
  if (
    response.status < 400 ||
    response.status >= 500 ||
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429
  ) {
    return undefined;
  }

  const errorCodes = [
    getTokenResponseField(result, 'error'),
    getTokenResponseField(result, 'status'),
  ];
  return errorCodes.find(
    (code): code is string =>
      typeof code === 'string' && DEFINITIVE_OAUTH_REJECTION_CODES.has(code),
  );
}

function createTokenRefreshError(response: Response, result: unknown): Error {
  const errorDescription = getTokenResponseField(result, 'error_description');
  const message =
    typeof errorDescription === 'string'
      ? errorDescription
      : `Token refresh failed with HTTP ${response.status}`;
  const oauthError = getDefinitiveOAuthRejectionCode(response, result);
  return oauthError
    ? new DefinitiveOAuthRejectionError(oauthError, message)
    : new Error(message);
}

function hasValidTokenMetadata(
  result: unknown,
): result is TokenResponse & { expires_in: number; token_type: string } {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    return false;
  }
  const tokenResponse = result as TokenResponse;
  return (
    typeof tokenResponse.expires_in === 'number' &&
    Number.isFinite(tokenResponse.expires_in) &&
    tokenResponse.expires_in > 0 &&
    typeof tokenResponse.token_type === 'string' &&
    tokenResponse.token_type.toLowerCase() === 'bearer'
  );
}

function normalizeEndpointProtocol(
  endpoint: string | undefined,
  issuerUrl: string,
) {
  if (!endpoint) return endpoint;

  try {
    const endpointUrl = new URL(endpoint);
    const issuer = new URL(issuerUrl);
    if (
      issuer.protocol === 'https:' &&
      endpointUrl.protocol === 'http:' &&
      endpointUrl.host === issuer.host
    ) {
      endpointUrl.protocol = issuer.protocol;
      return endpointUrl.toString();
    }
  } catch {
    return endpoint;
  }

  return endpoint;
}

export function normalizeIdentityProviderDiscovery(
  discovery: DiscoveryDocument,
  issuerUrl: string,
): DiscoveryDocument {
  const endSessionEndpoint = normalizeEndpointProtocol(
    discovery.endSessionEndpoint,
    issuerUrl,
  );

  return {
    ...discovery,
    authorizationEndpoint: normalizeEndpointProtocol(
      discovery.authorizationEndpoint,
      issuerUrl,
    ),
    revocationEndpoint: normalizeEndpointProtocol(
      discovery.revocationEndpoint,
      issuerUrl,
    ),
    tokenEndpoint: normalizeEndpointProtocol(
      discovery.tokenEndpoint,
      issuerUrl,
    ),
    ...(endSessionEndpoint ? { endSessionEndpoint } : {}),
  };
}

export async function fetchIdentityProviderDiscovery(
  issuerUrl: string,
  signal?: AbortSignal,
): Promise<DiscoveryDocument> {
  const normalizedIssuerUrl = issuerUrl.replace(/\/+$/, '');
  const response = await fetch(
    `${normalizedIssuerUrl}/.well-known/openid-configuration`,
    {
      mode: 'cors',
      headers: { Accept: 'application/json, text/javascript; q=0.01' },
      ...(signal ? { signal } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Identity provider discovery failed with HTTP ${response.status}`,
    );
  }

  const discoveryDocument = (await response.json()) as NonNullable<
    DiscoveryDocument['discoveryDocument']
  >;
  return {
    discoveryDocument,
    authorizationEndpoint: discoveryDocument.authorization_endpoint,
    tokenEndpoint: discoveryDocument.token_endpoint,
    revocationEndpoint: discoveryDocument.revocation_endpoint,
    userInfoEndpoint: discoveryDocument.userinfo_endpoint,
    endSessionEndpoint: discoveryDocument.end_session_endpoint,
    registrationEndpoint: discoveryDocument.registration_endpoint,
  };
}

export function createProviderLogoutUrl(
  discovery: DiscoveryDocument,
  redirectUri: string,
  idTokenHint?: string,
) {
  if (!discovery.endSessionEndpoint) return null;

  const logoutUrl = new URL(discovery.endSessionEndpoint);
  logoutUrl.searchParams.set('client_id', MOBILE_OAUTH_CLIENT_ID);
  logoutUrl.searchParams.set('post_logout_redirect_uri', redirectUri);
  if (idTokenHint) {
    logoutUrl.searchParams.set('id_token_hint', idTokenHint);
  }
  return logoutUrl.toString();
}

export async function revokeRefreshToken(
  refreshToken: string,
  discovery: DiscoveryDocument,
) {
  if (Platform.OS === 'web' || !discovery.revocationEndpoint) {
    return;
  }

  const response = await fetch(discovery.revocationEndpoint, {
    body: new URLSearchParams({
      client_id: MOBILE_OAUTH_CLIENT_ID,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (!response.ok) {
    const result = (await response.json()) as TokenResponse;
    throw new Error(
      typeof result.error_description === 'string'
        ? result.error_description
        : `Token revocation failed with HTTP ${response.status}`,
    );
  }
}

export async function exchangeAuthorizationCode({
  code,
  codeVerifier,
  discovery,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  discovery: DiscoveryDocument;
  redirectUri: string;
}): Promise<StoredAccessToken> {
  if (!discovery.tokenEndpoint) {
    throw new Error('The identity provider does not publish a token endpoint.');
  }

  const response = await fetch(discovery.tokenEndpoint, {
    body: new URLSearchParams({
      client_id: MOBILE_OAUTH_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  const result = (await response.json()) as TokenResponse;

  if (
    !response.ok ||
    typeof result.access_token !== 'string' ||
    !hasValidTokenMetadata(result)
  ) {
    const description =
      typeof result.error_description === 'string'
        ? result.error_description
        : `Token exchange failed with HTTP ${response.status}`;
    throw new Error(description);
  }

  return {
    accessToken: result.access_token,
    idToken: typeof result.id_token === 'string' ? result.id_token : undefined,
    expiresAt: Date.now() + result.expires_in * 1000,
    refreshToken:
      typeof result.refresh_token === 'string'
        ? result.refresh_token
        : undefined,
    scope: typeof result.scope === 'string' ? result.scope : '',
    tokenType: 'Bearer',
  };
}

export async function exchangeAuthorizationCodeForCurrentPlatform(input: {
  code: string;
  codeVerifier: string;
  discovery: DiscoveryDocument;
  redirectUri: string;
}): Promise<StoredAccessToken> {
  if (Platform.OS !== 'web') {
    return exchangeAuthorizationCode(input);
  }

  const response = await fetch(`${getBackendUrl()}/auth/token`, {
    body: new URLSearchParams({
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    }),
    credentials: 'include',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  const result = (await response.json()) as TokenResponse;
  if (!response.ok || !hasValidTokenMetadata(result)) {
    throw new Error(
      typeof result.error_description === 'string'
        ? result.error_description
        : `Token exchange failed with HTTP ${response.status}`,
    );
  }

  return {
    accessToken: '',
    expiresAt: Date.now() + result.expires_in * 1000,
    idToken: typeof result.id_token === 'string' ? result.id_token : undefined,
    refreshToken: undefined,
    scope: typeof result.scope === 'string' ? result.scope : '',
    tokenType: 'Bearer',
  };
}

export async function refreshAccessToken(
  token: StoredAccessToken | undefined,
  discovery: DiscoveryDocument,
  signal?: AbortSignal,
): Promise<StoredAccessToken> {
  if (Platform.OS === 'web') {
    const response = await fetch(`${getBackendUrl()}/auth/refresh`, {
      credentials: 'include',
      method: 'POST',
      ...(signal ? { signal } : {}),
    });
    const result: unknown = await response.json();
    if (!response.ok || !hasValidTokenMetadata(result)) {
      throw createTokenRefreshError(response, result);
    }
    return {
      accessToken: '',
      expiresAt: Date.now() + result.expires_in * 1000,
      idToken:
        typeof result.id_token === 'string' ? result.id_token : token?.idToken,
      scope:
        typeof result.scope === 'string' ? result.scope : token?.scope ?? '',
      tokenType: 'Bearer',
    };
  }

  if (!token?.refreshToken || !discovery.tokenEndpoint) {
    throw new Error('No refresh token is available.');
  }
  const response = await fetch(discovery.tokenEndpoint, {
    body: new URLSearchParams({
      client_id: MOBILE_OAUTH_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    ...(signal ? { signal } : {}),
  });
  const result: unknown = await response.json();
  if (
    !response.ok ||
    !hasValidTokenMetadata(result) ||
    typeof result.access_token !== 'string'
  ) {
    throw createTokenRefreshError(response, result);
  }
  return {
    accessToken: result.access_token,
    idToken:
      typeof result.id_token === 'string' ? result.id_token : token.idToken,
    expiresAt: Date.now() + result.expires_in * 1000,
    refreshToken:
      typeof result.refresh_token === 'string'
        ? result.refresh_token
        : token.refreshToken,
    scope: typeof result.scope === 'string' ? result.scope : token.scope,
    tokenType: 'Bearer',
  };
}

export function getDisplayNameFromClaims(claims: Record<string, unknown>) {
  for (const claim of ['name', 'preferred_username', 'email', 'nickname']) {
    const value = claims[claim];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function getProfilePictureFromClaims(claims: Record<string, unknown>) {
  const picture = claims.picture;
  if (typeof picture !== 'string' || !picture.trim()) return undefined;

  try {
    const url = new URL(picture.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export type AccountProvider =
  | 'apple'
  | 'discord'
  | 'facebook'
  | 'github'
  | 'gitlab'
  | 'google'
  | 'linkedin'
  | 'microsoft'
  | 'x';

export function getAccountProviderFromClaims(claims: Record<string, unknown>) {
  const provider = ['provider', 'idp', 'identity_provider', 'connection']
    .map((key) => claims[key])
    .find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

  if (!provider) return undefined;

  const normalizedProvider = provider
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const knownProviders: { key: AccountProvider; values: string[] }[] = [
    { key: 'apple', values: ['apple'] },
    { key: 'discord', values: ['discord'] },
    { key: 'facebook', values: ['facebook'] },
    { key: 'github', values: ['github'] },
    { key: 'gitlab', values: ['gitlab'] },
    { key: 'google', values: ['google'] },
    { key: 'linkedin', values: ['linkedin'] },
    { key: 'microsoft', values: ['microsoft', 'azuread', 'entra'] },
    { key: 'x', values: ['twitter', 'x'] },
  ];

  return knownProviders.find(({ values }) =>
    values.some((value) => normalizedProvider.includes(value)),
  )?.key;
}

export async function verifyAuthenticatedEndpointRejectsAnonymousRequest() {
  const response = await fetch(`${getBackendUrl()}/api/v1/me`);

  if (response.status !== 401) {
    throw new Error(
      `Anonymous authenticated-endpoint request returned HTTP ${response.status}`,
    );
  }

  return response.status;
}
