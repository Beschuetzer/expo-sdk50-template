import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logError, logInfo } from '../src/logging';

const apiEnvironmentFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../.env',
);

if (existsSync(apiEnvironmentFile)) {
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error('Node.js 20.12 or newer is required to load apps/api/.env');
  }
  process.loadEnvFile(apiEnvironmentFile);
}

async function seedDevelopmentData() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'Development seed refused: NODE_ENV must be exactly "development".',
    );
  }

  if (process.env.SEED_DEVELOPMENT_DATA !== 'true') {
    logInfo('development_seed_skipped', {
      reason: 'SEED_DEVELOPMENT_DATA is not true',
    });
    return;
  }

  const examples = [
    { name: 'Ada Lovelace', email: 'ada@example.com' },
    { name: 'Grace Hopper', email: 'grace@example.com' },
  ];
  logInfo('development_seed_started', { exampleCount: examples.length });
  const db = new PrismaClient();

  try {
    for (const example of examples) {
      await db.example.upsert({
        where: { email: example.email },
        create: example,
        update: { name: example.name },
      });
    }

    logInfo('development_seed_completed', {
      exampleCount: examples.length,
    });
  } finally {
    await db.$disconnect();
  }
}

seedDevelopmentData().catch((error: unknown) => {
  logError('development_seed_failed', { error });
  process.exitCode = 1;
});
