import type { ClientToServerEvents, ServerToClientEvents } from '@screenify/shared';
import { io, type Socket } from 'socket.io-client';
import { env } from '../config/env';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(token: string): AppSocket {
  return io(env.wsUrl, {
    auth: { token },
    autoConnect: false,
    // Vai direto para WebSocket, sem a fase de long-polling do Socket.IO
    transports: ['websocket'],
  });
}