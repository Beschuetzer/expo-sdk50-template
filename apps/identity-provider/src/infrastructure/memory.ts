import type {
  AuthorizationCode,
  AuthorizationCodeStore,
  ClientStore,
  OAuthClient,
  RefreshToken,
  RefreshTokenStore,
  User,
  UserStore,
} from '../domain/types';

export class InMemoryClientStore implements ClientStore {
  constructor(private readonly clients: OAuthClient[]) {}

  findById(clientId: string) {
    return this.clients.find((client) => client.clientId === clientId);
  }
}

export class InMemoryUserStore implements UserStore {
  constructor(private readonly users: User[]) {}

  authenticate(username: string, password: string) {
    return this.users.find(
      (user) => user.username === username && user.password === password,
    );
  }

  findById(userId: string) {
    return this.users.find((user) => user.id === userId);
  }
}

export class InMemoryAuthorizationCodeStore implements AuthorizationCodeStore {
  private readonly codes = new Map<string, AuthorizationCode>();

  save(code: AuthorizationCode) {
    this.codes.set(code.code, code);
  }

  consume(code: string) {
    const authorizationCode = this.codes.get(code);
    this.codes.delete(code);
    return authorizationCode;
  }
}

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly tokens = new Map<string, RefreshToken>();

  save(token: RefreshToken) {
    this.tokens.set(token.token, token);
  }

  consume(token: string) {
    const refreshToken = this.tokens.get(token);
    this.tokens.delete(token);
    return refreshToken;
  }

  revoke(token: string) {
    this.tokens.delete(token);
  }
}

export function createDevelopmentStores() {
  const expoGoRedirectUri = process.env.IDP_MOBILE_REDIRECT_URI?.trim();
  const mobileScheme =
    process.env.IDP_MOBILE_SCHEME?.trim() || 'expo50sdktemplate';

  return {
    clientStore: new InMemoryClientStore([
      {
        clientId: 'mobile-development-client',
        clientType: 'public',
        redirectUris: [
          'http://localhost:8081/oauth/callback',
          `${mobileScheme}://oauth/callback`,
          ...(expoGoRedirectUri ? [expoGoRedirectUri] : []),
        ],
        allowedScopes: ['openid', 'profile', 'api:read'],
        allowedGrantTypes: ['authorization_code', 'refresh_token'],
      },
      {
        clientId: 'api-development-client',
        clientSecret: 'api-development-secret',
        clientType: 'confidential',
        redirectUris: [],
        allowedScopes: ['api:read'],
        allowedGrantTypes: ['client_credentials'],
      },
    ]),
    userStore: new InMemoryUserStore([
      {
        id: 'development-user',
        username: 'test@test.com',
        password: 'test',
        claims: { email: 'demo@example.com' },
      },
    ]),
    authorizationCodeStore: new InMemoryAuthorizationCodeStore(),
    refreshTokenStore: new InMemoryRefreshTokenStore(),
  };
}
