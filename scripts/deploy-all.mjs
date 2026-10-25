import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const mobileRoot = path.join(workspaceRoot, 'apps', 'mobile');
const args = process.argv.slice(2);
const appName = args[0];
const platform = args[1] ?? 'all';
const validPlatforms = ['android', 'ios', 'all'];

function printUsage() {
  console.log(
    'Usage: npm run deploy:all -- <heroku-app-name> [android|ios|all]',
  );
}

function runNpm(commandArgs, options = {}) {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) {
    console.error('Unable to locate npm CLI. Run this using npm run deploy:all.');
    process.exit(1);
  }

  const result = spawnSync(process.execPath, [npmCliPath, ...commandArgs], {
    cwd: workspaceRoot,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    console.error(`Unable to run npm: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (args.length === 1 && ['--help', '-h'].includes(appName)) {
  printUsage();
  process.exit(0);
}

if (!appName || appName.startsWith('--')) {
  printUsage();
  process.exit(1);
}

if (args.length > 2 || !validPlatforms.includes(platform)) {
  console.error(`Invalid platform: ${platform}`);
  printUsage();
  process.exit(1);
}

console.log(`Deploying API to Heroku app ${appName}...`);
runNpm(['run', 'heroku:setup', '--', appName, '--deploy']);

console.log(`Starting EAS production build for ${platform}...`);
runNpm(
  [
    'exec',
    '--yes',
    '--package=eas-cli@latest',
    '--',
    'eas',
    'build',
    '--platform',
    platform,
    '--profile',
    'production',
    '--non-interactive',
    '--no-wait',
  ],
  { cwd: mobileRoot },
);

console.log('API deployed and EAS build started.');