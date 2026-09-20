export type ClientType = 'public' | 'confidential';

export type OAuthClient = {
  clientId: string;
  clientSecret?: string;
  clientType: ClientType;
  redirectUris: string[];
  allowedScopes: string[];
  allowedGrantTypes: (
    | 'authorization_code'
    | 'client_credentials'
    | 'refresh_token'
  )[];
};

export type User = {
  id: string;
  username: string;
  password: string;
  claims?: Record<string, string | number | boolean>;
};

export type AuthorizationCode = {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  expiresAt: number;
};

export type RefreshToken = {
  token: string;
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: number;
};

export interface ClientStore {
  findById(clientId: string): OAuthClient | undefined;
}

export interface UserStore {
  authenticate(username: string, password: string): User | undefined;
  findById(userId: string): User | undefined;
}

export interface AuthorizationCodeStore {
  save(code: AuthorizationCode): void;
  consume(code: string): AuthorizationCode | undefined;
}

export interface RefreshTokenStore {
  save(token: RefreshToken): void;
  consume(token: string): RefreshToken | undefined;
  revoke(token: string): void;
}
