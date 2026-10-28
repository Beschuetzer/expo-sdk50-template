# API

Node.js HTTP API for local development and production-oriented extension.

## Structure

- `src/config`: environment parsing and validated runtime configuration.
- `src/auth`: OAuth2 bearer-token middleware and the injectable auth boundary.
- `src/routes`: individual HTTP route handlers.
- `src/app.ts`: Express middleware and versioned route composition, independent of the listening socket.
- `src/server.ts`: server creation, startup, and shutdown lifecycle.
- `src/main.ts`: process entrypoint and signal handling.
- `src/app.spec.ts`: API contract tests using Node's built-in test runner.

## Runtime configuration

- `HOST`: bind address, default `0.0.0.0`.
- `PORT`: TCP port from `1` to `65535`, default `4200`. Set it in
  `apps/api/.env` to change the API port during `npm run dev`; the same value is
  used for the local Expo API URL.
- `NODE_ENV`: runtime environment label, default `development`.
- `DATABASE_URL`: MongoDB connection string for Prisma. Required for database access.
- `AUTH_ISSUER_BASE_URL`: OAuth2/OIDC issuer base URL. Required for protected routes.
- `AUTH_AUDIENCE`: expected OAuth2 access-token audience. Required for protected routes.
- `AUTH_REQUIRED_SCOPES`: optional space- or comma-separated baseline scopes required by all protected routes. Feature-specific scopes are enforced at route level.

Relationship and payment-request routes use these resource-server permissions:

```text
relationships:read
relationships:create
relationships:invite
relationships:accept-invite
payment-requests:read
payment-requests:write
```

## Prisma + MongoDB

This API is preconfigured for Prisma with a MongoDB datasource so you can attach a document-backed database without custom driver glue.

1. Copy the sample values from `apps/api/.env.example`.
2. Set `DATABASE_URL` to your MongoDB connection string.
3. Define your application models in `apps/api/prisma/schema.prisma`.
4. Run `npx prisma generate --schema=apps/api/prisma/schema.prisma` after changing the schema.
5. For local database migrations in a MongoDB project, use `npx prisma db push --schema=apps/api/prisma/schema.prisma` or `npx prisma migrate dev` if you are using a relational provider.

For MongoDB, Prisma uses the native `mongodb` provider and document IDs are represented as `ObjectId` strings.

For the hosted identity provider, use:

```powershell
$env:AUTH_ISSUER_BASE_URL='https://identity-server-00186add9672.herokuapp.com/'; $env:AUTH_AUDIENCE='https://identity-server-00186add9672.herokuapp.com/resources/api'; npm run api
```

The API process defaults to the hosted issuer and
`https://identity-server-00186add9672.herokuapp.com/resources/api` audience
when they are not provided explicitly. Clients must send the OAuth access token
as the bearer token. The ID token is for the OAuth client and has the client ID
as its audience, so it is correctly rejected by this resource server.

## Commands

- `GET /health` returns a public JSON health response for deployment probes.
- `GET /api/v1/me` is a protected example resource and requires a valid OAuth2 bearer token.
- `POST /api/v1/relationships/:relationshipId/invitations` creates a one-time invitation link for a relationship owner.
- `GET /api/v1/invitations/:token` previews an invitation for an authenticated user.
- `POST /api/v1/invitations/:token/accept` accepts an invitation using the authenticated user's subject claim.
- `npm run api` starts the API through Nx.
- `npx nx run api:test` runs the API contract tests.
- `npx nx run api:typecheck` validates TypeScript without emitting files.
- `npx nx run api:build` emits the compiled API to `dist/apps/api`.
- `npm run dev` starts the mobile app and API together.

### OAuth2 architecture

The API is an OAuth2 resource server, not an identity provider. An external
OAuth2/OIDC provider issues access tokens; the API validates those tokens using
issuer discovery, audience validation, and cached JWKS keys through
`express-oauth2-jwt-bearer`. It does not store client secrets or passwords.

Protected routes opt into authentication at route registration and receive the
validated claims on `request.auth`. Keep provider-specific behavior inside
`src/auth/middleware.ts`; route handlers should consume claims and remain
independent of Auth0, Entra, Okta, or another provider. Tests can inject an
`AuthMiddleware` through `createApp` without contacting a real identity
provider.

Protected routes fail closed with `503 auth_not_configured` if the provider
settings are removed. Never replace that behavior with a development token
bypass in shared or production code.

## Deploy to Heroku

This repository is an Nx monorepo, so Heroku must be configured against the
repository root, not `apps/api`. The root `build` script builds the API, and
the root `Procfile` starts the compiled API with `npm run api:start`.

### Prerequisites

1. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli).
2. Log in with `heroku login`.
3. Commit the repository changes you want to deploy.

From the repository root, run:

```sh
npm install
npm run heroku:setup -- my-api-name
```

The setup command:

- builds the API locally with `npm run api:build`;
- creates the Heroku app if it does not exist;
- adds or updates the `heroku` Git remote; and
- sets `NODE_ENV=production`.

It does not set `PORT` or `HOST`. Heroku supplies `PORT` dynamically, and the
API defaults to listening on `0.0.0.0`, which is the correct binding for a
Heroku dyno. Do not hard-code either value in Heroku config.

The setup command only configures the app. Deploy the current branch with:

```sh
git push heroku HEAD:main
```

Or configure and deploy in one explicit command:

```sh
npm run heroku:setup -- my-api-name --deploy
```

Heroku will run the root `npm run build` lifecycle during deployment and then
use the `web` process from `Procfile`. After deployment, verify the API with:

```sh
heroku open /health --app my-api-name
```

The expected response contains `"status":"ok"`. Logs are available with:

```sh
heroku logs --tail --app my-api-name
```

### Connecting the mobile app

The mobile app must use the deployed HTTPS URL in its production environment,
for example `https://my-api-name-abc123.herokuapp.com`. Do not use the local
`192.168.x.x:4200` address outside local development. Configure the mobile
Expo public environment values for the deployment before creating the mobile
build, including the production environment marker and API host expected by
the mobile URL resolver.

Heroku config variables are appropriate for server-side configuration and
secrets. Mobile `EXPO_PUBLIC_*` values are bundled into the client and are not
secret.
