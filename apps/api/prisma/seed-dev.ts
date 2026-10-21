import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

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
    console.log(
      '[dev-seed] Skipped. Set SEED_DEVELOPMENT_DATA=true to enable it.',
    );
    return;
  }

  const examples = [
    { name: 'Ada Lovelace', email: 'ada@example.com' },
    { name: 'Grace Hopper', email: 'grace@example.com' },
  ];
  console.log(`[dev-seed] Starting: ${examples.length} examples.`);
  const db = new PrismaClient();

  try {
    for (const example of examples) {
      await db.example.upsert({
        where: { email: example.email },
        create: example,
        update: { name: example.name },
      });
    }

    console.log(`[dev-seed] Complete: ${examples.length} examples upserted.`);
  } finally {
    await db.$disconnect();
  }
}

seedDevelopmentData().catch((error: unknown) => {
  console.error('[dev-seed] Failed:', error);
  process.exitCode = 1;
});
