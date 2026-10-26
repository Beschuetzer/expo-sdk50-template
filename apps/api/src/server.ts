import { createServer, type Server } from 'node:http';

import { createApp } from './app';
import { loadConfig, type ApiConfig } from './config/env';
import { logError, logInfo } from './logging';

export function createApiServer(config: ApiConfig = loadConfig()) {
  const server = createServer(createApp(config));

  server.on('error', (error) => {
    logError('api_server_error', { error });
  });

  return server;
}

export function startApiServer(server: Server, config: ApiConfig) {
  server.listen(config.port, config.host, () => {
    logInfo('api_server_listening', {
      environment: config.environment,
      host: config.host,
      port: config.port,
    });
  });

  return server;
}

export function stopApiServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
