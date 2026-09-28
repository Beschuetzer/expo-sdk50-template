## Expo 50 Nx Starter Monorepo

A neutral Expo SDK 50 starter shell managed by Nx, with a minimal Node.js backend for local development.

## AI / LLM onboarding

This repository is intentionally structured for AI-assisted development and extension. The most important repo rules are:

- The mobile app must remain internationalized. All visible user text goes through the translation map in `apps/mobile/utils/i18n.tsx`.
- The mobile app supports system, light, and dark themes. New UI should be theme-aware and should not assume a single fixed color scheme.
- Shared contracts live in `libs/shared-types/src` and should be reused across apps instead of duplicated.
- The API, identity provider, and mobile app each have separate responsibilities and should stay decoupled.

For detailed repo instructions, see [AGENTS.md](AGENTS.md).

## Projects

- `mobile`: Expo Router app in `apps/mobile`, preserving the existing Expo SDK 50 and gluestack UI v1 setup.
- `api`: Express-based OAuth2 resource server in `apps/api`.
- `identity-provider`: development OAuth2/OIDC provider in `apps/identity-provider`, supporting Authorization Code + PKCE and Client Credentials.
- `shared-types`: source-only TypeScript contracts in `libs/shared-types`, consumed by both apps.

The API currently exposes public `GET /health` and protected `GET /api/v1/me`
on port `4200`.

The local identity provider runs on port `4300`. It publishes discovery and
JWKS metadata, issues RSA-signed access tokens, and keeps development clients,
users, and authorization codes in memory. Replace those stores before using it
for production; it is a provider scaffold, not a production account system.

### Security posture

The local identity provider is development-only. It uses in-memory users,
clients, and authorization codes, demo credentials, and an ephemeral signing
key. It rejects `NODE_ENV=production` at startup. Production deployments must
use a managed OAuth2/OIDC provider or replace the stores and signing-key
lifecycle with durable, rotated, audited infrastructure before exposing an
account or token endpoint.

Run `npm run dev` to start the mobile app, API, and identity provider with one
LAN issuer. The home screen's authenticated-endpoint button opens the provider's
PKCE sign-in form on first use, stores the resulting access token in native
SecureStore, and calls `GET /api/v1/me` with the Bearer token.

Native access tokens are refreshed with rotating refresh tokens stored in
SecureStore. Web builds keep both tokens behind HttpOnly cookies managed by the
API BFF, so browser JavaScript does not access token values. Refresh failure
clears the session and requires a new PKCE sign-in.

## Shared Types

Cross-application request and response contracts belong in
`libs/shared-types/src`. Export them from `libs/shared-types/src/index.ts` and
import them with `@expo-50sdk-template/shared-types` from either the API or
mobile app. Keep this library limited to platform-independent TypeScript types:
it must not import React Native, Expo, Node runtime modules, or application
implementation code.

The development typechecks resolve the library source directly. Production API
builds first emit declaration files for the library and then consume those
declarations through the Nx project dependency. Add a new contract under a
focused folder such as `src/lib/api`, export it from the library entry point,
and run `npx nx run shared-types:typecheck` plus the affected app typechecks.

## Mobile Architecture

Mobile code is organized by responsibility:

- `app`: Expo Router screens and navigation composition.
- `features`: product capabilities with their API functions, query hooks, and feature tests.
- `components`: reusable UI, domain-independent hooks, and shared services.
- `components/ui`: theme-aware primitives such as `ThemeAwareSurface`,
  `ThemeAwareText`, and `ThemeAwareHeading`.
- `state`: Redux slices for client state and the shared TanStack Query client configuration.
- `utils`: cross-cutting concerns such as internationalization, theme resolution, storage, and platform helpers.

For a server-backed feature, keep the request function in
`apps/mobile/features/<feature>/api.ts`, the cache hook in
`apps/mobile/features/<feature>/hooks`, and consume the hook from a screen or
feature component. This keeps screens focused on rendering and user actions.

### Redux and TanStack Query boundaries

Redux is for client state that the application owns, such as form values,
preferences, authentication state, and UI flags. TanStack Query is for remote
server state, including request status, stale data, retries, invalidation, and
cache lifetimes. Do not copy query results into Redux; doing so creates two
sources of truth and removes much of TanStack Query's value.

The singleton QueryClient in `apps/mobile/state/queryClient.ts` persists its
cache through AsyncStorage and is mounted by `PersistQueryClientProvider` in
the root layout. Redux Persist uses the same storage mechanism for client
state, but the two persisted stores remain separate and independently
versioned.

The starter home screen includes cache verification controls. Press `Test
Backend Connection` to fetch and cache the health response, `Read Cached
Health` to inspect that response without a network request, and `Clear Backend
Cache` to remove it. Reading the cache after clearing should report a cache
miss.

Redux DevTools are enabled in development through
`redux-devtools-expo-dev-plugin@0.2.1`, the newest release compatible with this
Expo SDK 50 template. After starting the mobile app, press `Shift+M` in the
Expo CLI and choose `Open devtools plugin - redux-devtools-expo-dev-plugin`.
The enhancer is disabled in production builds.

### Lists

`@shopify/flash-list` is already installed and used by the home screen. Use it
for data-driven lists, provide a stable `keyExtractor`, and set an
`estimatedItemSize`. Prefer the shared theme-aware primitives for list rows so
light and dark mode behavior stays consistent across screens.

## Local Development

Install dependencies once:

```bash
npm install
```

When starting from a clone, initialize the deployment identity before building:

```bash
npm run init
```

The initializer assigns the Expo name, slug, deep-link scheme, iOS bundle ID,
Android package, EAS project ID, and production API/OIDC URLs. It creates local
API and identity-provider environment files only when they do not already
exist. Database credentials, OAuth provider credentials, EAS authentication,
and other production secrets must still be supplied separately.

Start Expo and the backend together:

```bash
npm run dev
```

On Windows, this opens separate PowerShell windows for Expo and the API so each
process keeps its own logs and interactive output. Close either window to stop
that process. On other platforms, both commands run in the current terminal.

Start either project independently:

```bash
npm run api
npm run mobile
```

The normal mobile command runs Expo directly via `npm --prefix apps/mobile`
instead of Nx, so Expo Go's QR code and interactive keyboard shortcuts (`a`,
`w`, `r`, `?`, etc.) work reliably on Windows terminals. To force a clean Metro
rebuild when troubleshooting, run:

```bash
npm --prefix apps/mobile run dev:clear
```

The mobile app's `Test Backend Connection` button calls the API health endpoint. `apps/mobile/setup.mjs` refreshes the Expo public IP and backend port in `apps/mobile/.env` before Metro starts. For a physical device, the generated IP must be reachable from the device.

The mobile template includes a typed i18n provider with English and Spanish
starter translations. The device locale selects the initial language, and the
language selector in the Settings tab persists the user's choice with
AsyncStorage. Add new messages in `apps/mobile/utils/i18n.tsx` and reference
them with `useI18n().t('section.key')` instead of hard-coding user-facing text.

Theme support is provided by `apps/mobile/utils/theme.tsx`. The Settings tab
allows users to choose System, Light, or Dark mode, and the choice is persisted
with AsyncStorage. The selected mode is shared by React Navigation, Gluestack,
the tab bar, and legacy themed components. Use `useColorScheme()` or
`useThemeMode()` for theme-aware behavior, and avoid fixed light-only colors in
new screens.

### Mobile releases

Pull requests run check-only ESLint plus `expo config` and `expo-doctor`.
Production mobile builds are started manually from the GitHub Actions `Mobile
release` workflow. Configure the real EAS project ID in `apps/mobile/app.json`
and add an `EXPO_TOKEN` repository secret before starting a build; the workflow
offers Android, iOS, and combined production builds.

## VS Code Debugging

The repository includes checked-in launch profiles under `.vscode`. They run
the Node services from TypeScript with source maps, so breakpoints can be set
directly in `apps/api/src` and `apps/identity-provider/src`.

1. Open the Run and Debug view.
2. Choose `Debug API and identity provider` to start both backend processes.
3. Set breakpoints in a route, authentication middleware, provider endpoint,
   or token service and exercise that code from the mobile app or an HTTP
   client.
4. Run mobile app via `npm run mobile`

The compound profile uses `http://localhost:4300` as the identity-provider
issuer and `api` as the API audience. It is intended for an emulator, web
browser, or HTTP client running on the same machine. Physical-device flows
should continue to use `npm run dev`, which computes a LAN issuer and opens
the services in separate terminals.

`Debug Expo web` starts the Expo web target and launches it in the VS Code
JavaScript debugger. Use it when you want to place breakpoints in mobile
screens, hooks, and API clients. For native Expo Go debugging, use Expo's
development menu and browser debugger for the running device; the native
runtime and the web runtime do not share identical platform behavior.

The profiles intentionally launch services directly rather than through
`npm run dev`: the latter opens detached Windows terminals, which prevents VS
Code from owning the Node debugger session.

## Nx Commands

```bash
npx nx show projects
npx nx run shared-types:typecheck
npx nx run mobile:typecheck
npx nx run api:typecheck
npx nx build api
npm run typecheck
npm run validate:startup
npm run idp
```

## Mobile Testing

The mobile Jest setup remains under `apps/mobile` and can be run through Nx:

```bash
npm test
npm run test:coverage
```

`npm run test:coverage` runs Jest once, prints the coverage statement, and
writes reports to `apps/mobile/coverage`. The HTML report is available at
`apps/mobile/coverage/lcov-report/index.html`; the machine-readable summary is
at `apps/mobile/coverage/coverage-summary.json`. The command fails when global
statements, branches, functions, or lines coverage falls below 90%.

### API and identity-provider testing

The API and identity-provider suites exercise real local HTTP servers and
request/response flows. Test doubles are limited to explicit external
boundaries, such as an unavailable database or an injected authentication
adapter, so tests remain deterministic without mocking internal route or OAuth
logic.

## Production API Configuration

The local API defaults to `HOST=0.0.0.0` and `PORT=4200`. Override either value when serving the API directly:

```powershell
$env:PORT=4300; npm run api
```