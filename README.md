## Expo 50 Nx Starter Monorepo

A neutral Expo SDK 50 starter shell managed by Nx, with a minimal Node.js backend and an external beta OIDC provider.

## AI / LLM onboarding

This repository is intentionally structured for AI-assisted development and extension. The most important repo rules are:

- The mobile app must remain internationalized. All visible user text goes through the translation map in `apps/mobile/utils/i18n.tsx`.
- The mobile app supports system, light, and dark themes. New UI should be theme-aware and should not assume a single fixed color scheme.
- Shared contracts live in `libs/shared-types/src` and should be reused across apps instead of duplicated.
- The API and mobile app remain separate from the externally managed identity provider.

For detailed repo instructions, see [AGENTS.md](AGENTS.md).

## Projects

- `mobile`: Expo Router app in `apps/mobile`, preserving the existing Expo SDK 50 and gluestack UI v1 setup.
- `api`: Express-based OAuth2 resource server in `apps/api`.
- `shared-types`: source-only TypeScript contracts in `libs/shared-types`, consumed by both apps.

The API currently exposes public `GET /health` and protected `GET /api/v1/me`
on port `4200`.

The API validates tokens from the configured beta identity provider using its
OIDC discovery and JWKS metadata. Set the issuer once in `apps/api/.env`; mobile
startup and the initializer reuse that value.

### Security posture

Identity management is provided externally; this workspace does not contain
an identity server or store user credentials.

Run `npm run dev` to start the mobile app and API. The home screen's
authenticated-endpoint button uses PKCE with the beta identity provider, stores
the resulting access token in native SecureStore, and calls `GET /api/v1/me`
with the Bearer token.

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

Use Node.js 26 for this workspace. The required range is `>=26.0.0 <27` and
the major version is pinned in `.nvmrc`.

Install dependencies once:

```bash
npm install
```

When starting from a clone, initialize the deployment identity before building:

```bash
npm run init
```

The initializer assigns the Expo name, slug, deep-link scheme, iOS bundle ID,
Android package, EAS project ID, and API/OIDC URLs. It creates the API
environment file if missing and updates its OIDC issuer. Database credentials,
OAuth client configuration, EAS authentication, and other production secrets
must still be supplied separately.

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

The mobile app's `Test Backend Connection` button calls the API health endpoint. `apps/mobile/setup.mjs` refreshes the Expo public IP and backend port and syncs the identity provider issuer from `apps/api/.env` into `apps/mobile/.env` before Metro starts. For a physical device, the generated IP must be reachable from the device.

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

EAS cloud builds do not read local `.env` files or `.env.example`. The build
profiles in `apps/mobile/eas.json` select the matching EAS environments:
`development`, `preview`, and `production`. Add
`EXPO_PUBLIC_OAUTH_CLIENT_ID` as a plain-text variable in each EAS environment,
using the same value as `AUTH_CLIENT_ID` in `apps/api/.env`. This client ID is
included in the mobile app and is public, not a secret. For example, run these
commands from `apps/mobile`, replacing `YOUR_AUTH_CLIENT_ID` with the value from
`apps/api/.env`:

```bash
npx --yes eas-cli@latest env:set --name EXPO_PUBLIC_OAUTH_CLIENT_ID --value "YOUR_AUTH_CLIENT_ID" --environment development --visibility plaintext
npx --yes eas-cli@latest env:set --name EXPO_PUBLIC_OAUTH_CLIENT_ID --value "YOUR_AUTH_CLIENT_ID" --environment preview --visibility plaintext
npx --yes eas-cli@latest env:set --name EXPO_PUBLIC_OAUTH_CLIENT_ID --value "YOUR_AUTH_CLIENT_ID" --environment production --visibility plaintext
```

The `preview` build uses the preview environment, and the release workflow's
production build uses the production environment. If the variable is missing,
mobile authentication fails at startup.

## VS Code Debugging

The repository includes checked-in launch profiles under `.vscode`. They run
the API from TypeScript with source maps, so breakpoints can be set directly in
`apps/api/src`.

1. Open the Run and Debug view.
2. Choose `Debug API` to start the API.
3. Set breakpoints in a route or authentication middleware and exercise the
    API from the mobile app or an HTTP client.
4. Run mobile app via `npm run mobile`

The API profile uses the beta identity issuer and `api` audience. It is intended
for an emulator, web browser, or HTTP client running on the same machine.

`Debug Expo web` starts the Expo web target and launches it in the VS Code
JavaScript debugger. Use it when you want to place breakpoints in mobile
screens, hooks, and API clients. For native Expo Go debugging, use Expo's
development menu and browser debugger for the running device; the native
runtime and the web runtime do not share identical platform behavior.

The profile launches the API directly rather than through `npm run dev`, which
opens detached Windows terminals and prevents VS Code from owning the Node
debugger session.

## Nx Commands

```bash
npx nx show projects
npx nx run shared-types:typecheck
npx nx run mobile:typecheck
npx nx run api:typecheck
npx nx build api
npm run typecheck
npm run validate:startup
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

### API testing

The API suite exercises real local HTTP servers and request/response flows.
Test doubles are limited to explicit external boundaries, such as an
unavailable database or an injected authentication adapter, so tests remain
deterministic without contacting the beta identity provider.

## Production API Configuration

The local API defaults to `HOST=0.0.0.0` and `PORT=4200`. Override either value when serving the API directly:

```powershell
$env:PORT=4300; npm run api
```