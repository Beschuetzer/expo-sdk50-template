import type { DiscoveryDocument } from 'expo-auth-session';
import { Platform } from 'react-native';

import type { StoredAccessToken } from './storage';

import { getBackendUrl } from '@/utils/helpers';
import { getIdentityProviderUrl } from '@/utils/platform';

export const MOBILE_OAUTH_CLIENT_ID = 'mobile-development-client';
export const MOBILE_OAUTH_SCOPES = ['openid', 'profile', 'api:read'];

export type AuthenticatedUser = {
  claims: Record<string, unknown>;
  subject: string | null;
};

type TokenResponse = {
  access_token?: unknown;
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

function getDiscoveryBaseUrl() {
  return getIdentityProviderUrl();
}

export function createIdentityProviderDiscovery(): DiscoveryDocument {
  const baseUrl = getDiscoveryBaseUrl();
  return {
    authorizationEndpoint: `${baseUrl}/authorize`,
    revocationEndpoint: `${baseUrl}/revoke`,
    tokenEndpoint: `${baseUrl}/token`,
  };
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
    refreshToken: undefined,
    scope: typeof result.scope === 'string' ? result.scope : '',
    tokenType: 'Bearer',
  };
}

export async function refreshAccessToken(
  token: StoredAccessToken,
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
      scope: typeof result.scope === 'string' ? result.scope : token.scope,
      tokenType: 'Bearer',
    };
  }

  if (!token.refreshToken || !discovery.tokenEndpoint) {
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
    !hasValidTokenMetadata(result) ||
    typeof result.refresh_token !== 'string'
  ) {
    throw new Error(
      typeof result.error_description === 'string'
        ? result.error_description
        : `Token refresh failed with HTTP ${response.status}`,
    );
  }
  return {
    accessToken: result.access_token,
    expiresAt: Date.now() + result.expires_in * 1000,
    refreshToken: result.refresh_token,
    scope: typeof result.scope === 'string' ? result.scope : token.scope,
    tokenType: 'Bearer',
  };
}

export async function getAuthenticatedUser(accessToken: string) {
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
    claims: result.claims ?? {},
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
