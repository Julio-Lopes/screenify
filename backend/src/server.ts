import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();
const httpServer = createServer(app);

httpServer.listen(env.PORT, () => {
  logger.info(`[HTTP] Server listening on port ${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info(`[HTTP] ${signal} received, shutting down`);

  httpServer.close((error) => {
    if (error) {
      logger.error({ err: error }, '[HTTP] Error while closing server');
      process.exit(1);
    }

    logger.info('[HTTP] Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('[HTTP] Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);