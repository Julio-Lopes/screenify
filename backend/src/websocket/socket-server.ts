import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { closeRoomForEveryone, registerRoomHandlers, stopTrackingParticipations } from './room.handlers.js';
import { socketAuth } from './socket-auth.js';
import type { AppServer } from './types.js';

let io: AppServer | null = null;

export function createSocketServer(httpServer: HttpServer): AppServer {
  const server: AppServer = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  });

  server.use(socketAuth);

  server.on('connection', (socket) => {
    logger.info({ userId: socket.data.user.id }, '[SOCKET] Connected');
    registerRoomHandlers(server, socket);
  });

  io = server;
  return server;
}

/** Usado pela API HTTP para avisar em tempo real que a sala foi excluída */
export function notifyRoomDeleted(roomId: string): void {
  if (io) {
    closeRoomForEveryone(io, roomId);
  }
}

/** Prepara o desligamento: a partir daqui, desconexões não gravam mais no banco uma a uma */
export function prepareSocketShutdown(): void {
  stopTrackingParticipations();
}