import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, URL } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), '..');
const apiEnvironmentFile = path.join(rootDir, 'apps/api/.env');
if (fs.existsSync(apiEnvironmentFile)) {
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error('Node.js 20.12 or newer is required to load apps/api/.env');
  }
  process.loadEnvFile(apiEnvironmentFile);
}
const IDP_URL = process.env.AUTH_ISSUER_BASE_URL?.trim().replace(/\/$/, '');
if (!IDP_URL) {
  throw new Error('AUTH_ISSUER_BASE_URL must be set in apps/api/.env');
}
const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!configuredDatabaseUrl) {
  throw new Error('DATABASE_URL must be set in apps/api/.env');
}
const configuredDatabase = new URL(configuredDatabaseUrl);
if (!['mongodb:', 'mongodb+srv:'].includes(configuredDatabase.protocol)) {
  throw new Error('DATABASE_URL must use the mongodb or mongodb+srv scheme');
}
const databaseName = decodeURIComponent(configuredDatabase.pathname.slice(1));
if (!databaseName) {
  throw new Error('DATABASE_URL must include a database name');
}

const commands = [
  { title: 'Expo mobile', script: 'mobile' },
  { title: 'Node API', script: 'api' },
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

async function seedDevelopmentData() {
  if (process.env.SEED_DEVELOPMENT_DATA !== 'true') {
    console.log(
      '[dev-seed] Disabled. Set SEED_DEVELOPMENT_DATA=true to seed development data.',
    );
    return;
  }

  console.log('[dev-seed] Starting before the development servers...');

  const seedProcess = spawn(
    'npm',
    ['--prefix', 'apps/api', 'run', 'prisma:seed:dev'],
    {
      cwd: rootDir,
      env: { ...process.env, ...sharedEnvironment },
      shell: true,
      stdio: 'inherit',
    },
  );

  await new Promise((resolve, reject) => {
    seedProcess.once('error', reject);
    seedProcess.once('exit', (code) => {
      if (code && code !== 0) {
        console.error(`[dev-seed] Failed with exit code ${code}.`);
        reject(new Error(`Development seed exited with code ${code}`));
        return;
      }
      console.log('[dev-seed] Finished successfully.');
      resolve();
    });
  });
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
configuredDatabase.protocol = 'mongodb:';
configuredDatabase.hostname = '127.0.0.1';
configuredDatabase.port = String(mongoPort);
configuredDatabase.searchParams.set('directConnection', 'true');
configuredDatabase.searchParams.set('serverSelectionTimeoutMS', '5000');
configuredDatabase.searchParams.set('connectTimeoutMS', '5000');
const sharedEnvironment = {
  NODE_ENV: 'development',
  AUTH_AUDIENCE: `${IDP_URL}/resources/api`,
  AUTH_ISSUER_BASE_URL: IDP_URL,
  DATABASE_URL: configuredDatabase.toString(),
  EXPO_PUBLIC_IDP_URL: IDP_URL,
  EXPO_PUBLIC_OAUTH_AUDIENCE: `${IDP_URL}/resources/api`,
  EXPO_PUBLIC_OAUTH_CLIENT_ID: 'client_ASCACaC-QT2cM8DmF2IroxFe',
  EXPO_PUBLIC_OAUTH_SCOPES:
    'openid profile email offline_access relationships:read relationships:create relationships:invite relationships:accept-invite payment-requests:read payment-requests:write',
};

await seedDevelopmentData();

if (process.platform === 'win32') {
  commands.forEach(startWindowsTerminal);
  console.log(`Started Expo mobile and Node API. OAuth2 issuer: ${IDP_URL}`);
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
