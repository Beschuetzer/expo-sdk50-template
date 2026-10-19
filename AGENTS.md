# AGENTS.md

This repository is a monorepo template for a mobile app and API, using a deployed external OIDC identity provider.

## Purpose of the repo

- `apps/mobile`: Expo SDK 50 React Native application using Expo Router, Redux Toolkit, Redux Persist, TanStack Query, and Gluestack UI v1.
- `apps/api`: Express OAuth2 resource server with TypeScript, Prisma-ready MongoDB configuration, and lightweight health/auth endpoints.
- `libs/shared-types`: platform-neutral TypeScript contracts that are shared across apps.

## Core rules for AI-assisted changes

1. Keep app responsibilities separated.
   - Mobile UI lives in `apps/mobile/app` and `apps/mobile/components`.
   - Feature logic should live under `apps/mobile/features/<feature>/`.
   - Shared contracts belong in `libs/shared-types/src`.
   - API routes and middleware live under `apps/api/src`.

2. Mobile app text must not be hard-coded.
   - Add user-facing strings to the i18n map in `apps/mobile/utils/i18n.tsx`.
   - Use `useI18n().t('section.key')` or `getMessage(...)` rather than literal text in screens/components.
   - Do not add raw English or Spanish UI labels directly into components unless the string is non-user-facing, such as a developer debug label.

3. Theme support is required.
   - The mobile app supports system, light, and dark mode.
   - Theme mode logic lives in `apps/mobile/utils/theme.tsx`.
   - New screens and components should be styled to work in both light and dark themes.
   - Avoid fixed light-only or dark-only colors; prefer theme-aware tokens or values derived from the active color scheme.

4. Respect the existing i18n and theming architecture.
   - If a screen or component needs user-visible text, add translation keys.
   - If a screen or component changes visual treatment, ensure it still renders correctly under both themes.
   - If a new feature requires settings persistence or UI selections, prefer the existing AsyncStorage-backed patterns used by the app.

5. Keep cross-app contracts typed and shared.
   - Add or update shared request/response interfaces in `libs/shared-types/src`.
   - Import them via `@expo-50sdk-template/shared-types` rather than duplicating interfaces in each app.
   - Shared types should remain framework-agnostic and not import React Native, Express, or app-specific runtime code.

6. Prefer minimal, targeted edits.
   - Do not broaden a fix beyond the root cause.
   - Preserve existing patterns and naming conventions used in the repository.
   - Favor the regression-tested path instead of introducing new abstractions unless required.

## Repo-specific gotchas to avoid

- Expo SDK 50 is pinned to older package APIs. Do not assume the latest expo-camera API exists in this repo.
  - `expo-camera` v14 has no `CameraView` and no QR scanning APIs.
  - This project uses `expo-barcode-scanner` for scanning flows.
- Gluestack UI v1 is not the same as the newer Tailwind/className-based versions.
  - Use the v1 compound component patterns and semantic sizing tokens, not the v2/v5 docs.
- The workspace uses Nx. Prefer the project-level commands in `package.json` and `apps/*/project.json` instead of inventing ad hoc build scripts.
- Do not commit secrets or local environment values. Use `.env` files locally and keep example values in `.env.example`-style files.

## Local development

```bash
npm install
npm run dev
npm run api
npm run mobile
npm run typecheck
npm run test
npm run test:coverage
```

Useful Nx commands:

```bash
npx nx show projects
npx nx run api:test
npx nx run api:typecheck
npx nx run mobile:typecheck
npx nx run shared-types:typecheck
```

## Testing expectations

- Add or update tests for behavior that changes.
- Favor real behavior checks over mock-heavy assertions.
- When a bug is fixed, verify the relevant target or test file before deciding the issue is resolved.

## Security and production posture

- The configured beta OIDC identity provider is external to this workspace.
- Do not store production credentials or signing keys in the repository.
- API configuration should be environment-driven and validated using `process.env` or explicit config objects.
- Keep OAuth2 and database configuration behind clear env variables and do not hard-code issuer URLs or secrets.

## Recommended working style for future contributors

- When adding new product features, start in `apps/mobile/features/<feature>`.
- Use the shared types package for API contracts.
- Keep the mobile app text translatable and theme-safe.
- Keep backend integrations behind small, typed boundaries and test them accordingly.
- Prefer maintainable, domain-specific layering over broad rewrites.

This repository is intentionally a starter template: keep it neutral, extensible, and easy to replace with a real product domain while preserving the quality gates and architecture conventions already in place.
