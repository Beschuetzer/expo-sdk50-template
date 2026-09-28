/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { stdin: input, stdout: output } = require('node:process');
const readline = require('node:readline/promises');

const root = path.resolve(__dirname, '..');
const mobileAppConfigPath = path.join(root, 'apps', 'mobile', 'app.json');
const easConfigPath = path.join(root, 'apps', 'mobile', 'eas.json');
const apiEnvPath = path.join(root, 'apps', 'api', '.env');
const apiEnvExamplePath = path.join(root, 'apps', 'api', '.env.example');
const idpEnvPath = path.join(root, 'apps', 'identity-provider', '.env');

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

function writeIfMissing(filePath, contents) {
  if (fs.existsSync(filePath)) {
    return false;
  }
  fs.writeFileSync(filePath, contents, 'utf8');
  return true;
}

function updateJson(filePath, update) {
  const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  update(document);
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
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
    const issuerUrl = await ask(
      rl,
      'OAuth/OIDC issuer URL',
      'https://your-production-issuer.example.com',
    );

    updateJson(mobileAppConfigPath, (config) => {
      config.expo.name = displayName;
      config.expo.slug = slug;
      config.expo.scheme = scheme;
      config.expo.ios.bundleIdentifier = bundleIdentifier;
      config.expo.android.package = androidPackage;
      config.expo.extra.eas.projectId = easProjectId;
    });

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

    const createdApiEnv = writeIfMissing(
      apiEnvPath,
      fs.readFileSync(apiEnvExamplePath, 'utf8'),
    );
    const createdIdpEnv = writeIfMissing(
      idpEnvPath,
      [
        'NODE_ENV="development"',
        'IDP_ISSUER="http://localhost:4300"',
        `IDP_MOBILE_SCHEME=${quoteEnv(scheme)}`,
        '',
      ].join('\n'),
    );

    console.log('\nInitialized mobile deployment configuration.');
    console.log(`- Expo slug: ${slug}`);
    console.log(`- Bundle/package identity: ${bundleIdentifier}`);
    console.log(`- EAS project: ${easProjectId}`);
    if (createdApiEnv) console.log('- Created apps/api/.env from its example.');
    if (createdIdpEnv) {
      console.log(
        '- Created apps/identity-provider/.env for local development.',
      );
    }
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
