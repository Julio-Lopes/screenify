import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import type { MediaRegistry } from '../mediasoup/media-registry.js';
import { logger } from '../utils/logger.js';
import { registerCursorHandlers } from './cursor.handlers.js';
import { registerDrawingHandlers } from './drawing.handlers.js';
import { registerMediaHandlers } from './media.handlers.js';
import { closeRoomForEveryone, registerRoomHandlers, stopTrackingParticipations } from './room.handlers.js';
import { socketAuth } from './socket-auth.js';
import { createConnectionGuard, limitEventRate, MAX_MESSAGE_BYTES } from './socket-limits.js';
import type { AppServer } from './types.js';

let realtime: { io: AppServer; media: MediaRegistry } | null = null;

export function createSocketServer(httpServer: HttpServer, media: MediaRegistry): AppServer {
  const io: AppServer = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
    // Mensagem maior que isso derruba a conexão antes de ser lida
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
  });

  // A ordem importa: primeiro o limite por IP (barato), depois a autenticação (consulta o banco)
  const connections = createConnectionGuard();
  io.use((socket, next) => connections.check(socket, next));
  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.info({ userId: socket.data.user.id }, '[SOCKET] Connected');
    connections.track(socket);
    limitEventRate(socket);
    registerRoomHandlers(io, socket, media);
    registerMediaHandlers(io, socket, media);
    registerDrawingHandlers(socket);
    registerCursorHandlers(socket);
  });

  realtime = { io, media };
  return io;
}

/** Usado pela API HTTP para avisar em tempo real que a sala foi excluída */
export async function notifyRoomDeleted(roomId: string): Promise<void> {
  if (realtime) {
    await closeRoomForEveryone(realtime.io, realtime.media, roomId);
  }
}

/** Prepara o desligamento: a partir daqui, desconexões não gravam mais no banco uma a uma */
export function prepareSocketShutdown(): void {
  stopTrackingParticipations();
}