import { loadConfig } from './config/env';
import { createApiServer, startApiServer, stopApiServer } from './server';

const developmentDefaults =
  process.env.NODE_ENV === 'production'
    ? {}
    : {
        AUTH_AUDIENCE: process.env.AUTH_AUDIENCE || 'api',
      };
const config = loadConfig({
  ...process.env,
  ...developmentDefaults,
});
const server = startApiServer(createApiServer(config), config);

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
