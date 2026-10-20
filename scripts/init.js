/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { stdin: input, stdout: output } = require('node:process');
const readline = require('node:readline/promises');

const root = path.resolve(__dirname, '..');
const rootPackagePath = path.join(root, 'package.json');
const lockfilePath = path.join(root, 'package-lock.json');
const sharedTypesPackagePath = path.join(
  root,
  'libs',
  'shared-types',
  'package.json',
);
const mobileAppConfigPath = path.join(root, 'apps', 'mobile', 'app.json');
const easConfigPath = path.join(root, 'apps', 'mobile', 'eas.json');
const apiEnvPath = path.join(root, 'apps', 'api', '.env');
const apiEnvExamplePath = path.join(root, 'apps', 'api', '.env.example');
const startDevScriptPath = path.join(root, 'scripts', 'start-dev.mjs');
const startMongoScriptPath = path.join(root, 'scripts', 'start-mongodb.mjs');
const stopMongoScriptPath = path.join(root, 'scripts', 'stop-mongodb.mjs');
const sharedTypesReferenceFiles = [
  path.join(root, 'apps', 'api', 'src', 'routes', 'health.ts'),
  path.join(root, 'apps', 'api', 'tsconfig.build.json'),
  path.join(root, 'apps', 'api', 'tsconfig.json'),
  path.join(root, 'apps', 'mobile', 'app', '(tabs)', 'index.tsx'),
  path.join(root, 'apps', 'mobile', 'features', 'backend', 'api.ts'),
  path.join(root, 'apps', 'mobile', 'tsconfig.json'),
  path.join(root, 'README.md'),
];
const templateSharedTypesName = '@expo-50sdk-template/shared-types';

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function compactIdentifier(value) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function quoteEnv(value) {
  return JSON.stringify(value);
}

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return undefined;

  const line = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trimStart().startsWith(`${key}=`));
  if (!line) return undefined;

  const value = line.slice(line.indexOf('=') + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value || undefined;
}

function writeIfMissing(filePath, contents) {
  if (fs.existsSync(filePath)) {
    return false;
  }
  fs.writeFileSync(filePath, contents, 'utf8');
  return true;
}

function setEnvValue(filePath, key, value) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const entry = `${key}=${quoteEnv(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const updatedContents = pattern.test(contents)
    ? contents.replace(pattern, entry)
    : `${contents}${contents.endsWith('\n') ? '' : '\n'}${entry}\n`;
  fs.writeFileSync(filePath, updatedContents, 'utf8');
}

function updateJson(filePath, update) {
  const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  update(document);
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

function updatePackageNames(packageName, sharedTypesName) {
  updateJson(rootPackagePath, (packageJson) => {
    packageJson.name = packageName;
  });

  updateJson(sharedTypesPackagePath, (packageJson) => {
    packageJson.name = sharedTypesName;
  });

  updateJson(lockfilePath, (lockfile) => {
    lockfile.name = packageName;
    lockfile.packages[''].name = packageName;

    const oldSharedTypesEntry =
      lockfile.packages['node_modules/@expo-50sdk-template/shared-types'];
    if (oldSharedTypesEntry) {
      delete lockfile.packages[
        'node_modules/@expo-50sdk-template/shared-types'
      ];
      lockfile.packages[`node_modules/${sharedTypesName}`] =
        oldSharedTypesEntry;
    }

    if (lockfile.dependencies?.['@expo-50sdk-template/shared-types']) {
      lockfile.dependencies[sharedTypesName] =
        lockfile.dependencies['@expo-50sdk-template/shared-types'];
      delete lockfile.dependencies['@expo-50sdk-template/shared-types'];
    }
  });

  for (const filePath of sharedTypesReferenceFiles) {
    const contents = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(
      filePath,
      contents.replaceAll(templateSharedTypesName, sharedTypesName),
      'utf8',
    );
  }
}

function updateMongoScripts(containerName, databaseName) {
  const startMongoScript = fs
    .readFileSync(startMongoScriptPath, 'utf8')
    .replace(
      /const containerName = '[^']+';/,
      `const containerName = '${containerName}';`,
    )
    .replace(
      /const volumeName = '[^']+';/,
      `const volumeName = '${containerName}-data';`,
    )
    .replace(
      /MONGO_INITDB_DATABASE=[^']+/,
      `MONGO_INITDB_DATABASE=${databaseName}`,
    )
    .replace(
      /(MongoDB is ready at mongodb:\/\/127\.0\.0\.1:\$\{hostPort\}\/)[^`]+/,
      `$1${databaseName}`,
    );
  fs.writeFileSync(startMongoScriptPath, startMongoScript, 'utf8');

  const startDevScript = fs
    .readFileSync(startDevScriptPath, 'utf8')
    .replace(
      /(DATABASE_URL: `mongodb:\/\/127\.0\.0\.1:\$\{mongoPort\}\/)[^`]+/,
      `$1${databaseName}`,
    );
  fs.writeFileSync(startDevScriptPath, startDevScript, 'utf8');

  const stopMongoScript = fs
    .readFileSync(stopMongoScriptPath, 'utf8')
    .replace(
      /const containerName = '[^']+';/,
      `const containerName = '${containerName}';`,
    );
  fs.writeFileSync(stopMongoScriptPath, stopMongoScript, 'utf8');
}

async function ask(rl, label, defaultValue) {
  const answer = (await rl.question(`${label} [${defaultValue}]: `)).trim();
  return answer || defaultValue;
}

async function main() {
  const rl = readline.createInterface({ input, output });
  try {
    const defaultName =
      path.basename(root) === 'expo-50sdk-template'
        ? 'My Expo App'
        : path.basename(root);
    const displayName = await ask(rl, 'Display name', defaultName);
    const slug = await ask(rl, 'Expo slug', slugify(displayName));
    const identifier = compactIdentifier(slug);
    const mongoName = slugify(slug) || 'app';
    const sharedTypesName = `@${mongoName}/shared-types`;
    const databaseName = mongoName.replace(/-/g, '_');
    const bundleIdentifier = await ask(
      rl,
      'iOS bundle identifier',
      `com.${identifier}`,
    );
    const androidPackage = await ask(rl, 'Android package', bundleIdentifier);
    const scheme = await ask(rl, 'Deep-link scheme', identifier);
    const easProjectId = await ask(
      rl,
      'EAS project ID (leave placeholder if not created yet)',
      'REPLACE_WITH_YOUR_EAS_PROJECT_ID',
    );
    const apiUrl = await ask(
      rl,
      'Deployed API URL',
      'https://your-production-api.example.com',
    );
    const issuerUrlDefault =
      readEnvValue(apiEnvPath, 'AUTH_ISSUER_BASE_URL') ||
      readEnvValue(apiEnvExamplePath, 'AUTH_ISSUER_BASE_URL');
    if (!issuerUrlDefault) {
      throw new Error('AUTH_ISSUER_BASE_URL must be set in the API env file.');
    }
    const issuerUrl = await ask(rl, 'OAuth/OIDC issuer URL', issuerUrlDefault);

    updateJson(mobileAppConfigPath, (config) => {
      config.expo.name = displayName;
      config.expo.slug = slug;
      config.expo.scheme = scheme;
      config.expo.ios.bundleIdentifier = bundleIdentifier;
      config.expo.android.package = androidPackage;
      config.expo.extra.eas.projectId = easProjectId;
    });

    updatePackageNames(mongoName, sharedTypesName);

    updateJson(easConfigPath, (config) => {
      for (const profileName of ['preview', 'production']) {
        config.build[profileName].env = {
          ...config.build[profileName].env,
          EXPO_PUBLIC_ENV: 'production',
          EXPO_PUBLIC_API_URL: apiUrl,
          EXPO_PUBLIC_IDP_URL: issuerUrl,
        };
      }
    });

    updateMongoScripts(mongoName, databaseName);

    const createdApiEnv = writeIfMissing(
      apiEnvPath,
      fs.readFileSync(apiEnvExamplePath, 'utf8'),
    );
    setEnvValue(apiEnvPath, 'AUTH_ISSUER_BASE_URL', issuerUrl);

    console.log('\nInitialized mobile deployment configuration.');
    console.log(`- Expo slug: ${slug}`);
    console.log(`- Bundle/package identity: ${bundleIdentifier}`);
    console.log(`- EAS project: ${easProjectId}`);
    if (createdApiEnv) console.log('- Created apps/api/.env from its example.');
    if (easProjectId === 'REPLACE_WITH_YOUR_EAS_PROJECT_ID') {
      console.log(
        'Next: create an EAS project and replace the placeholder ID.',
      );
    }
    console.log(
      'Secrets and production provider credentials still need to be configured.',
    );
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(`Initialization failed: ${error.message}`);
  process.exitCode = 1;
});
