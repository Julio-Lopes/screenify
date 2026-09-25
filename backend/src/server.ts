import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { closeAllOpenParticipations } from './services/participant.service.js';
import { logger } from './utils/logger.js';
import { createSocketServer, prepareSocketShutdown } from './websocket/socket-server.js';

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

async function start(): Promise<void> {
  const closed = await closeAllOpenParticipations();
  if (closed > 0) {
    logger.info({ closed }, '[ROOM] Closed participations left open by the previous run');
  }

  httpServer.listen(env.PORT, () => {
    logger.info(`[HTTP] Server listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info(`[HTTP] ${signal} received, shutting down`);

  setTimeout(() => {
    logger.error('[HTTP] Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();

  // A partir daqui as desconexões não gravam no banco uma a uma:
  // a saída de todos é registrada de uma vez, antes de fechar as conexões
  prepareSocketShutdown();

  closeAllOpenParticipations()
    .catch((error: unknown) => logger.error({ err: error }, '[ROOM] Failed to close participations'))
    .finally(() => {
      void io.close((error) => void finish(error));
    });
}

async function finish(error?: Error): Promise<void> {
  if (error) {
    logger.error({ err: error }, '[HTTP] Error while closing server');
  } else {
    logger.info('[HTTP] Server closed');
  }

  await prisma.$disconnect();
  logger.info('[DB] Disconnected');

  process.exit(error ? 1 : 0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((error: unknown) => {
  logger.fatal({ err: error }, '[HTTP] Failed to start');
  process.exit(1);
});