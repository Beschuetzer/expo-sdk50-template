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

function commandName(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(commandName(command), commandArgs, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    console.error(`Unable to run ${command}: ${result.error.message}`);
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
run('npm', ['run', 'heroku:setup', '--', appName, '--deploy']);

console.log(`Starting EAS production build for ${platform}...`);
run(
  'npx',
  [
    '--yes',
    'eas-cli@latest',
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