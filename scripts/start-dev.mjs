import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), '..');
const localNetworkAddress = Object.values(os.networkInterfaces())
  .flatMap((networkInterface) => networkInterface ?? [])
  .find((address) => address.family === 'IPv4' && !address.internal)?.address;
const authIssuer = `http://${localNetworkAddress ?? '127.0.0.1'}:4300`;
const expoGoRedirectUri = `exp://${localNetworkAddress ?? '127.0.0.1'}:8081/--/oauth/callback`;
const commands = [
  { title: 'Expo mobile', script: 'mobile' },
  { title: 'Node API', script: 'api' },
  { title: 'OAuth2 identity provider', script: 'idp' },
];

function startWindowsTerminal({ title, script }) {
  const escapedRootDir = rootDir.replaceAll("'", "''");
  const environmentCommands = Object.entries(sharedEnvironment).map(
    ([key, value]) => `$env:${key} = '${value}'`,
  );
  const command = [
    `$host.UI.RawUI.WindowTitle = '${title}'`,
    ...environmentCommands,
    `Set-Location -LiteralPath '${escapedRootDir}'`,
    `npm run ${script}`,
  ].join('; ');

  const child = spawn(
    'cmd.exe',
    [
      '/c',
      'start',
      title,
      'powershell.exe',
      '-NoLogo',
      '-NoExit',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      command,
    ],
    { detached: true, stdio: 'ignore', windowsHide: false },
  );

  child.once('error', (error) => {
    console.error(`Unable to open the ${title} terminal: ${error.message}`);
    process.exitCode = 1;
  });
  child.unref();
}

function startSharedTerminal({ script }) {
  const child = spawn('npm', ['run', script], {
    cwd: rootDir,
    env: { ...process.env, ...sharedEnvironment },
    stdio: 'inherit',
    shell: true,
  });

  return child;
}

const databaseProcess = spawn('node', ['scripts/start-mongodb.mjs'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

await new Promise((resolve, reject) => {
  databaseProcess.once('error', reject);
  databaseProcess.once('exit', (code) => {
    if (code && code !== 0) {
      reject(new Error(`MongoDB startup exited with code ${code}`));
      return;
    }
    resolve();
  });
});

const mongoPortText = fs
  .readFileSync(path.join(rootDir, '.mongodb-port'), 'utf8')
  .trim();
const mongoPort = Number(mongoPortText.replace(/^\uFEFF/, ''));
if (!Number.isInteger(mongoPort) || mongoPort < 1 || mongoPort > 65535) {
  throw new Error('MongoDB startup did not provide a valid host port');
}
const sharedEnvironment = {
  AUTH_AUDIENCE: 'api',
  AUTH_ISSUER_BASE_URL: authIssuer,
  DATABASE_URL: `mongodb://127.0.0.1:${mongoPort}/relationship_app`,
  IDP_ISSUER: authIssuer,
  IDP_MOBILE_REDIRECT_URI: expoGoRedirectUri,
};

if (process.platform === 'win32') {
  commands.forEach(startWindowsTerminal);
  console.log(
    `Started Expo mobile, Node API, and OAuth2 identity provider. OAuth2 issuer: ${authIssuer}`,
  );
} else {
  const children = commands.map(startSharedTerminal);
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve, reject) => {
          child.once('error', reject);
          child.once('exit', (code) => {
            if (code && code !== 0) {
              reject(new Error(`npm run command exited with code ${code}`));
              return;
            }
            resolve();
          });
        }),
    ),
  );
}
