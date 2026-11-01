# Expo SDK 58 Maintenance Notes

This mobile project is upgraded to Expo SDK 58, React Native 0.88.1, and React
19.3.0. Keep Expo native modules aligned with the SDK rather than upgrading
them independently.

## Updating Expo

From `apps/mobile`, update Expo and align SDK modules with:

```bash
npm install expo@~58
npx expo install --fix
npx expo-doctor
```

The supported Node.js engine range is
`^22.13.0 || ^24.3.0 || ^26.0.0 || >=27.0.0`.

## Native-module notes

- Barcode scanning is implemented with `CameraView` and
  `useCameraPermissions` from `expo-camera`. Do not reintroduce the removed
  `expo-barcode-scanner` package.
- Reanimated 4 uses `react-native-worklets/plugin` as the final Babel plugin.
- FlashList v2 sizes items automatically; `estimatedItemSize` is not supported.
- Keep static web export behavior by leaving Router `asyncRoutes.web` disabled.
- Splash artwork and camera permission configuration use their config plugins
  in `app.json`.

## Native projects

Android is generated locally and ignored by Git. Before regenerating it, review
any native-only customizations and ensure their configuration is represented
in `app.json` or a config plugin. Regenerate Android for the configured SDK
with:

```bash
npx expo prebuild --platform android --no-install --clean
```

The EAS post-install hook runs this prebuild when Android is missing. There is
no checked-in iOS project; EAS generates it from app config.

## Verification

Run the mobile typecheck, Jest coverage suite, Expo config validation, and
Expo Doctor after a dependency or native-project update:

```bash
npx nx run mobile:typecheck
npm run test:coverage
npm run validate:mobile
```
