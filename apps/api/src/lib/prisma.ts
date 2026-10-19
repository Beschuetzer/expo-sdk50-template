import { PrismaClient } from '@prisma/client';

import { logError, logInfo } from '../logging';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectPrisma(databaseUrl?: string) {
  if (!databaseUrl) {
    logInfo('database_connection_skipped', {
      reason: 'DATABASE_URL is not configured',
    });
    return false;
  }

  try {
    await prisma.$connect();
    logInfo('database_connected', { provider: 'mongodb' });
    return true;
  } catch (error) {
    logError('database_connection_failed', {
      error: error instanceof Error ? error.stack : String(error),
      provider: 'mongodb',
    });
    return false;
  }
}

export default prisma;
