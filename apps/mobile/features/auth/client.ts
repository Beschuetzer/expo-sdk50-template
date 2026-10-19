import type { DiscoveryDocument } from 'expo-auth-session';
import { Platform } from 'react-native';

import type { StoredAccessToken } from './storage';

import { getBackendUrl } from '@/utils/helpers';

export const MOBILE_OAUTH_CLIENT_ID =
  process.env.EXPO_PUBLIC_OAUTH_CLIENT_ID?.trim() ||
  'client_ASCACaC-QT2cM8DmF2IroxFe';
export const MOBILE_OAUTH_AUDIENCE =
  process.env.EXPO_PUBLIC_OAUTH_AUDIENCE?.trim() ||
  'https://identity-beta.adammajor.com/resources/api';
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
  process.env.EXPO_PUBLIC_OAUTH_SCHEME?.trim() || 'relationshipapp';
export const MOBILE_OAUTH_POST_LOGOUT_REDIRECT_URI =
  process.env.EXPO_PUBLIC_OAUTH_POST_LOGOUT_REDIRECT_URI?.trim();

export function createInvitationUrl(token: string) {
  const encodedToken = encodeURIComponent(token);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/invitation/${encodedToken}`;
  }
  return `${MOBILE_OAUTH_SCHEME}://invitation/${encodedToken}`;
}

export type AuthenticatedUser = {
  claims: Record<string, unknown>;
  subject: string | null;
};

type TokenResponse = {
  access_token?: unknown;
  id_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
};

function hasValidTokenMetadata(
  result: TokenResponse,
): result is TokenResponse & { expires_in: number; token_type: string } {
  return (
    typeof result.expires_in === 'number' &&
    Number.isFinite(result.expires_in) &&
    result.expires_in > 0 &&
    typeof result.token_type === 'string' &&
    result.token_type.toLowerCase() === 'bearer'
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
): Promise<StoredAccessToken> {
  if (Platform.OS === 'web') {
    const response = await fetch(`${getBackendUrl()}/auth/refresh`, {
      credentials: 'include',
      method: 'POST',
    });
    const result = (await response.json()) as TokenResponse;
    if (!response.ok || !hasValidTokenMetadata(result)) {
      throw new Error(
        typeof result.error_description === 'string'
          ? result.error_description
          : `Token refresh failed with HTTP ${response.status}`,
      );
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
  });
  const result = (await response.json()) as TokenResponse;
  if (
    !response.ok ||
    typeof result.access_token !== 'string' ||
    !hasValidTokenMetadata(result)
  ) {
    throw new Error(
      typeof result.error_description === 'string'
        ? result.error_description
        : `Token refresh failed with HTTP ${response.status}`,
    );
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

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }

  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < padded.length; index += 4) {
    const first = alphabet.indexOf(padded[index]);
    const second = alphabet.indexOf(padded[index + 1]);
    const third = alphabet.indexOf(padded[index + 2]);
    const fourth = alphabet.indexOf(padded[index + 3]);
    result += String.fromCharCode((first << 2) | (second >> 4));
    if (third >= 0) {
      result += String.fromCharCode(((second & 15) << 4) | (third >> 2));
    }
    if (fourth >= 0) {
      result += String.fromCharCode(((third & 3) << 6) | fourth);
    }
  }
  return result;
}

function decodeIdTokenClaims(idToken: string | undefined) {
  if (!idToken) return {};
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return {};
    const binary = decodeBase64Url(payload);
    const json = decodeURIComponent(
      Array.from(binary)
        .map(
          (character) =>
            `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`,
        )
        .join(''),
    );
    const claims: unknown = JSON.parse(json);
    return claims && typeof claims === 'object'
      ? (claims as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
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

export async function getAuthenticatedUser(
  accessToken: string,
  idToken?: string,
) {
  const response = await fetch(`${getBackendUrl()}/api/v1/me`, {
    ...(Platform.OS === 'web'
      ? { credentials: 'include' as const }
      : { headers: { Authorization: `Bearer ${accessToken}` } }),
  });
  const result = (await response.json()) as Partial<AuthenticatedUser> & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      result.message ??
        `Authenticated request failed with HTTP ${response.status}`,
    );
  }

  return {
    claims: {
      ...decodeIdTokenClaims(idToken),
      ...(result.claims ?? {}),
    },
    subject: result.subject ?? null,
  } satisfies AuthenticatedUser;
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
