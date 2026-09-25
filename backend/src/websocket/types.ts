import type { ClientToServerEvents, ServerToClientEvents } from '@screenify/shared';
import type { Server, Socket } from 'socket.io';
import type { AuthUser } from '../services/user.service.js';

/** Dados que o servidor guarda em cada conexão */
export interface SocketData {
  user: AuthUser;
  roomId: string | null;
}

// O terceiro parâmetro são eventos entre servidores (não usamos: é um único servidor)
export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}