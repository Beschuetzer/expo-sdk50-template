# Copilot instructions

This repo is a monorepo template for an Expo mobile app and a TypeScript API, using a deployed external OIDC identity provider.

## Mandatory conventions

- Keep user-facing mobile text in `apps/mobile/utils/i18n.tsx` and use translation keys in components.
- Do not hard-code visible text in the mobile app; all new UI strings should be added to the i18n map.
- Support system, light, and dark modes in the mobile app. Prefer theme-aware colors and spacing, and avoid fixed light-only/dark-only styling.
- Keep business logic separated by app boundary: mobile screens in `apps/mobile/app`, feature logic in `apps/mobile/features`, shared contracts in `libs/shared-types`, API code in `apps/api/src`.
- Use the shared types package for API and app-to-app contracts rather than duplicating interfaces.

## Repo structure

- `apps/mobile`: Expo app
- `apps/api`: Express API
- `libs/shared-types`: shared TypeScript contracts

## Commands

```bash
npm install
npm run dev
npm run api
npm run mobile
npm run typecheck
npm run test
npm run test:coverage
```

## Gotchas

- The mobile app uses Expo SDK 58 and React Native 0.88. Keep Expo native-module versions aligned with the SDK, use `expo-camera` for barcode scanning, and check installed APIs before upgrading third-party native packages.
- The repo uses Nx and project-specific configs; prefer the existing project commands over ad hoc shell scripts.
- The beta identity provider is external to this workspace.

## Quality bar

- Add or update tests for changed behavior.
- Keep fixes targeted and avoid broad refactors.
- Preserve the current architecture and naming conventions unless the requested change clearly requires a new pattern.
