import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const mobileDir = path.join(rootDir, 'apps', 'mobile');
const appJsonPath = path.join(mobileDir, 'app.json');
const mobilePackageJsonPath = path.join(mobileDir, 'package.json');
const apiProjectJsonPath = path.join(rootDir, 'apps', 'api', 'project.json');
const envPath = path.join(mobileDir, '.env');

const requiredPackages = [
  'expo',
  'expo-router',
  'react',
  'react-native',
  '@gluestack-ui/themed',
  '@gluestack-ui/config',
  '@reduxjs/toolkit',
  'redux-persist',
];

const requiredEnvironmentKeys = [
  'EXPO_PUBLIC_IP_ADDRESS',
  'EXPO_PUBLIC_PORT_NUMBER',
];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to read ${path.basename(filePath)}: ${error.message}`,
    );
  }
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing at ${filePath}`);
  }
}

function collectWarnings(warnings) {
  if (warnings.length > 0) {
    console.warn('\nStartup validation warnings:');
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
}

function main() {
  const warnings = [];

  ensureFileExists(packageJsonPath, 'package.json');
  ensureFileExists(appJsonPath, 'app.json');
  ensureFileExists(mobilePackageJsonPath, 'apps/mobile/package.json');
  ensureFileExists(apiProjectJsonPath, 'apps/api/project.json');

  const mobilePackageJson = readJson(mobilePackageJsonPath);
  const appJson = readJson(appJsonPath);
  const expoConfig = appJson.expo ?? {};

  const missingPackages = requiredPackages.filter(
    (pkg) =>
      !mobilePackageJson.dependencies?.[pkg] &&
      !mobilePackageJson.devDependencies?.[pkg],
  );

  if (missingPackages.length > 0) {
    throw new Error(`Missing required packages: ${missingPackages.join(', ')}`);
  }

  if (!expoConfig.name || !expoConfig.slug) {
    throw new Error('app.json must define expo.name and expo.slug');
  }

  if (expoConfig.experiments?.typedRoutes !== true) {
    warnings.push(
      'typedRoutes is not enabled; Expo Router route typing may be less strict than expected.',
    );
  }

  if (!expoConfig.plugins || !Array.isArray(expoConfig.plugins)) {
    warnings.push(
      'No expo.plugins array found; native plugin assumptions may be incomplete.',
    );
  }

  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const missingEnvKeys = requiredEnvironmentKeys.filter(
      (key) => !new RegExp(`^${key}=`, 'm').test(envFile),
    );

    if (missingEnvKeys.length > 0) {
      throw new Error(
        `Missing required environment variables in .env: ${missingEnvKeys.join(', ')}`,
      );
    }
  } else {
    warnings.push(
      'No .env file found yet. The app may create it at startup via setup.mjs.',
    );
  }

  const pluginNames = (expoConfig.plugins ?? [])
    .map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin))
    .filter(Boolean);

  const hasSampleDomainPlugins = [
    'expo-camera',
    'expo-share-intent',
    'expo-barcode-scanner',
  ];
  const sampleDomainExtras = hasSampleDomainPlugins.filter((name) =>
    pluginNames.includes(name),
  );

  if (sampleDomainExtras.length > 0) {
    warnings.push(
      `This template includes app-specific sample plugins (${sampleDomainExtras.join(', ')}). If you are repurposing the repo, review whether those should stay or be removed.`,
    );
  }

  console.log('Startup validation passed.');
  collectWarnings(warnings);
}

main();
