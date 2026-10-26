import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const androidAppDirectory = path.join(appRoot, 'android', 'app');

if (
  process.env.EAS_BUILD_PLATFORM !== 'android' ||
  existsSync(androidAppDirectory)
) {
  process.exit(0);
}

console.warn(
  'Android project is missing after EAS setup; generating it with Expo Prebuild.',
);

const require = createRequire(import.meta.url);
const expoCliPath = require.resolve('expo/bin/cli');
const result = spawnSync(
  process.execPath,
  [
    expoCliPath,
    'prebuild',
    '--platform',
    'android',
    '--no-install',
    '--clean',
  ],
  {
    cwd: appRoot,
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  if (result.signal) {
    throw new Error(`Expo Prebuild terminated by ${result.signal}.`);
  }
  process.exit(result.status ?? 1);
}

if (!existsSync(androidAppDirectory)) {
  throw new Error('Expo Prebuild completed without creating android/app.');
}
