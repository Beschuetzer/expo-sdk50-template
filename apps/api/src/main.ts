import { loadConfig } from './config/env';
import { connectPrisma } from './lib/prisma';
import { createApiServer, startApiServer, stopApiServer } from './server';

if (!process.env.AUTH_AUDIENCE || !process.env.AUTH_ISSUER_BASE_URL) {
  throw new Error('AUTH_AUDIENCE and AUTH_ISSUER_BASE_URL must be set');
}
const config = loadConfig(process.env);
const server = startApiServer(createApiServer(config), config);
void connectPrisma(config.databaseUrl);

function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down API`);
  stopApiServer(server)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error('Failed to shut down API cleanly', error);
      process.exit(1);
    });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
