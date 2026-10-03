import { execFileSync } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const containerName = 'expo-50sdk-template';
const volumeName = 'expo-50sdk-template-data';
const imageName = 'mongo:latest';
const defaultHostPort = 27017;
const portFilePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.mongodb-port',
);
const maxAttempts = 30;

function runPodman(args, options = {}) {
  const output = execFileSync('podman', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });

  return typeof output === 'string' ? output.trim() : '';
}

function getContainer() {
  try {
    return JSON.parse(runPodman(['container', 'inspect', containerName]))[0];
  } catch {
    return undefined;
  }
}

function getMappedHostPort(container) {
  const mappings = container?.NetworkSettings?.Ports?.['27017/tcp'];
  const port = Number(mappings?.[0]?.HostPort);
  return Number.isInteger(port) && port > 0 ? port : undefined;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailableHostPort() {
  const configuredPort = Number(process.env.MONGODB_HOST_PORT);
  const firstPort =
    Number.isInteger(configuredPort) && configuredPort > 0
      ? configuredPort
      : defaultHostPort;

  for (let port = firstPort; port <= firstPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(
    `No available MongoDB host port found starting at ${firstPort}`,
  );
}

async function ensureContainer() {
  let existingContainer = getContainer();

  const command = existingContainer?.Config?.Cmd ?? [];
  const isReplicaSetContainer =
    command.includes('--replSet') && command.includes('rs0');
  if (existingContainer && !isReplicaSetContainer) {
    console.log(
      'Recreating the local MongoDB container with replica-set support for Prisma transactions.',
    );
    if (existingContainer.State?.Status === 'running') {
      runPodman(['stop', containerName], { stdio: 'inherit' });
    }
    runPodman(['rm', containerName], { stdio: 'inherit' });
    existingContainer = undefined;
  }

  let existingHostPort = getMappedHostPort(existingContainer);
  if (existingContainer && existingContainer.State?.Status !== 'running') {
    const canReuseMapping =
      existingHostPort !== undefined &&
      (await isPortAvailable(existingHostPort));

    if (!canReuseMapping) {
      console.log(
        'The existing MongoDB host port is occupied; recreating the container on an available port.',
      );
      runPodman(['rm', '--force', containerName], { stdio: 'inherit' });
      existingContainer = undefined;
      existingHostPort = undefined;
    }
  }

  const hostPort = existingHostPort ?? (await findAvailableHostPort());

  if (!existingContainer) {
    runPodman(
      [
        'run',
        '--detach',
        '--name',
        containerName,
        '--publish',
        `${hostPort}:27017`,
        '--env',
        'MONGO_INITDB_DATABASE=expo_50sdk_template',
        '--volume',
        `${volumeName}:/data/db`,
        imageName,
        'mongod',
        '--replSet',
        'rs0',
        '--bind_ip_all',
      ],
      { stdio: 'inherit' },
    );
    return hostPort;
  }

  if (existingContainer.State?.Status !== 'running') {
    runPodman(['start', containerName], { stdio: 'inherit' });
  }

  return hostPort;
}

async function waitForMongo() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = runPodman([
        'exec',
        containerName,
        'mongosh',
        '--quiet',
        '--eval',
        'db.adminCommand({ ping: 1 }).ok',
      ]);

      if (result === '1') {
        return;
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `MongoDB container did not become ready after ${maxAttempts} seconds`,
  );
}

function initializeReplicaSet() {
  runPodman([
    'exec',
    containerName,
    'mongosh',
    '--quiet',
    '--eval',
    "try { rs.status().ok } catch (error) { rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] }).ok }",
  ]);
}

async function waitForPrimary() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = runPodman([
        'exec',
        containerName,
        'mongosh',
        '--quiet',
        '--eval',
        'db.hello().isWritablePrimary ? 1 : 0',
      ]);
      if (result === '1') return;
    } catch {
      // MongoDB may still be electing the single replica-set member.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `MongoDB replica set did not become primary after ${maxAttempts} seconds`,
  );
}

try {
  runPodman(['--version']);
  fs.rmSync(portFilePath, { force: true });
  const hostPort = await ensureContainer();
  await waitForMongo();
  initializeReplicaSet();
  await waitForPrimary();
  fs.writeFileSync(portFilePath, `${hostPort}\n`, 'utf8');
  console.log(
    `MongoDB is ready at mongodb://127.0.0.1:${hostPort}/expo_50sdk_template`,
  );
} catch (error) {
  console.error(
    'Unable to start local MongoDB. Ensure Podman Desktop or the Podman machine is running.',
  );
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
