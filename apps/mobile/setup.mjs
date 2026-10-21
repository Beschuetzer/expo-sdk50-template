import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

//#region ENV Files setup
export const BACKEND_PORT = 4200;
export const EXPO_PUBLIC_ENV_STRING = 'EXPO_PUBLIC_ENV';
export const EXPO_PUBLIC_IP_ADDRESS_STRING = 'EXPO_PUBLIC_IP_ADDRESS';
export const EXPO_PUBLIC_PORT_NUMBER_STRING = 'EXPO_PUBLIC_PORT_NUMBER';
//#endregion

const currentFilePath = fileURLToPath(import.meta.url);
const ENV_FILE_PATH = path.join(path.dirname(currentFilePath), '.env');
const API_ENV_FILE_PATH = path.resolve(
  path.dirname(currentFilePath),
  '../api/.env',
);

async function addIpAddressToEnvFile() {
  if (fs.existsSync(API_ENV_FILE_PATH)) {
    if (typeof process.loadEnvFile !== 'function') {
      throw new Error(
        'Node.js 20.12 or newer is required to load apps/api/.env',
      );
    }
    process.loadEnvFile(API_ENV_FILE_PATH);
  }

  const identityProviderUrl = process.env.AUTH_ISSUER_BASE_URL?.trim().replace(
    /\/+$/,
    '',
  );
  const oauthAudience =
    process.env.AUTH_AUDIENCE?.trim() ||
    (identityProviderUrl ? `${identityProviderUrl}/resources/api` : undefined);
  let lines;
  const toWrite = [
    `${EXPO_PUBLIC_ENV_STRING}=development`,
    `${EXPO_PUBLIC_IP_ADDRESS_STRING}=${getIPAddress()}`,
    `${EXPO_PUBLIC_PORT_NUMBER_STRING}=${BACKEND_PORT}`,
    ...(identityProviderUrl
      ? [`EXPO_PUBLIC_IDP_URL=${identityProviderUrl}`]
      : []),
    ...(oauthAudience ? [`EXPO_PUBLIC_OAUTH_AUDIENCE=${oauthAudience}`] : []),
  ];
  const environmentRegex = new RegExp(
    String.raw`\s*${EXPO_PUBLIC_ENV_STRING}\s*=`,
    'i',
  );
  const ipAddressRegex = new RegExp(
    String.raw`\s*${EXPO_PUBLIC_IP_ADDRESS_STRING}\s*`,
    'ig',
  );
  const portNumberRegex = new RegExp(
    String.raw`\s*${EXPO_PUBLIC_PORT_NUMBER_STRING}\s*`,
    'ig',
  );
  const identityProviderUrlRegex = /^\s*EXPO_PUBLIC_IDP_URL\s*=.*$/i;
  const oauthAudienceRegex = /^\s*EXPO_PUBLIC_OAUTH_AUDIENCE\s*=.*$/i;

  try {
    const data = await fs.promises.readFile(ENV_FILE_PATH, 'utf-8');
    lines =
      data
        ?.split('\n')
        ?.map((data) => data.trim())
        .filter(
          (data) =>
            !data.match(ipAddressRegex) &&
            !data.match(portNumberRegex) &&
            !data.match(environmentRegex) &&
            (!identityProviderUrl || !identityProviderUrlRegex.test(data)) &&
            (!oauthAudience || !oauthAudienceRegex.test(data)) &&
            Boolean(data),
        ) || [];
  } catch {
    await fs.promises.writeFile(
      ENV_FILE_PATH,
      `${toWrite.join('\n')}`,
      'utf-8',
    );
    return;
  }

  lines.forEach((line) => toWrite.push(line));
  await fs.promises.writeFile(ENV_FILE_PATH, `${toWrite.join('\n')}`, 'utf-8');
}

function getIPAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      // Skip over internal IPv6 addresses and loopback addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  throw new Error('IP address could not be determined');
}

addIpAddressToEnvFile();
