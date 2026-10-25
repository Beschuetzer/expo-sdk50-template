import { requestAuthenticatedJson } from './authenticatedClient';

export type AuthenticatedUser = {
  claims: Record<string, unknown>;
  subject: string | null;
};

type AuthenticatedUserResponse = Partial<AuthenticatedUser>;

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

export async function getAuthenticatedUser(idToken?: string) {
  const { data, token } =
    await requestAuthenticatedJson<AuthenticatedUserResponse>(
      '/api/v1/me',
      {},
      {
        fallbackErrorMessage: (statusCode) =>
          `Authenticated request failed with HTTP ${statusCode}`,
      },
    );

  return {
    claims: {
      ...decodeIdTokenClaims(token?.idToken ?? idToken),
      ...(data.claims ?? {}),
    },
    subject: data.subject ?? null,
  } satisfies AuthenticatedUser;
}
