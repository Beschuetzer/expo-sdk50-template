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

function getBackendPort() {
  const configuredPort = process.env.PORT?.trim();
  if (!configuredPort) {
    return BACKEND_PORT;
  }

  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

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
  const backendPort = getBackendPort();
  const toWrite = [
    `${EXPO_PUBLIC_ENV_STRING}=development`,
    `${EXPO_PUBLIC_IP_ADDRESS_STRING}=${getIPAddress()}`,
    `${EXPO_PUBLIC_PORT_NUMBER_STRING}=${backendPort}`,
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
  const interfaces = Object.entries(os.networkInterfaces());
  const isWifiInterface = (name) => /^(wi-?fi|wireless|wlan)/i.test(name);
  const isVirtualInterface = (name) =>
    /(virtual|vEthernet|wsl|hyper-v|docker|vmware|virtualbox|loopback|tailscale|zerotier|vpn|tun\d*|tap\d*|bridge)/i.test(
      name,
    );
  const orderedInterfaces = [
    ...interfaces.filter(([name]) => isWifiInterface(name)),
    ...interfaces.filter(
      ([name]) => !isWifiInterface(name) && !isVirtualInterface(name),
    ),
  ];

  for (const [, addresses] of orderedInterfaces) {
    for (const iface of addresses ?? []) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !iface.address.startsWith('169.254.')
      ) {
        return iface.address;
      }
    }
  }
  throw new Error('IP address could not be determined');
}


addIpAddressToEnvFile();
