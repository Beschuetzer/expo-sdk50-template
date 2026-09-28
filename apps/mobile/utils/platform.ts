import { getEnvironmentOrDefault } from './environment';
import { logWhenDevelopmentMode } from './logging';

export function displayAlert(object: object | null) {
  logWhenDevelopmentMode(
    object ? JSON.stringify(object, null, 2) : object ?? 'displayAlert called',
  );
}

export function getBackendUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const config = getEnvironmentOrDefault();

  return config.env.match(/dev|development/i)
    ? `http://${config.ipAddress}:${config.portNumber}`
    : 'https://your-production-api.example.com';
}

export function getIdentityProviderUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_IDP_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const config = getEnvironmentOrDefault();
  const port = process.env.EXPO_PUBLIC_IDP_PORT_NUMBER?.trim() || '4300';
  return `http://${config.ipAddress}:${port}`;
}

export async function measureExecutionTime(
  func: () => Promise<void>,
  key = 'Func',
  shouldLog = true,
) {
  const start = performance.now();
  func && (await func());
  const end = performance.now();
  if (shouldLog) {
    logWhenDevelopmentMode({ [`executionTimeOf${key}`]: end - start });
  }
}

export function wait(ms: number) {
  if (ms <= 0) return;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, ms);
  });
}

export async function delay(ms: number) {
  if (ms <= 0) return;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, ms);
  });
}
