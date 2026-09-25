import type {
  ClientToServerEvents,
  JoinRoomPayload,
  JoinRoomResult,
  ServerToClientEvents,
} from '@screenify/shared';
import type { Express } from 'express';
import { createServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { createApp } from '../../src/app.js';
import { createSocketServer } from '../../src/websocket/socket-server.js';

export type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface TestServer {
  app: Express;
  url: string;
  /** Abre um cliente Socket.IO real; rejeita com a mensagem do erro de conexão */
  connect: (token?: string) => Promise<TestClient>;
  close: () => Promise<void>;
}

/** Sobe o servidor completo (HTTP + WebSocket) numa porta livre escolhida pelo sistema */
export async function startTestServer(): Promise<TestServer> {
  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  const clients = new Set<TestClient>();

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Não foi possível descobrir a porta do servidor de teste');
  }
  const url = `http://localhost:${address.port}`;

  return {
    app,
    url,
    connect: (token) =>
      new Promise((resolve, reject) => {
        const client: TestClient = connect(url, {
          auth: token ? { token } : {},
          transports: ['websocket'],
          reconnection: false,
          forceNew: true,
        });
        clients.add(client);
        client.once('connect', () => resolve(client));
        client.once('connect_error', (error) => reject(error));
      }),
    close: async () => {
      for (const client of clients) client.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}

export function joinRoom(client: TestClient, payload: JoinRoomPayload): Promise<JoinRoomResult> {
  return client.timeout(2000).emitWithAck('room:join', payload);
}

/** Espera o próximo evento do servidor e devolve os argumentos dele */
export function nextEvent<E extends keyof ServerToClientEvents>(
  client: TestClient,
  event: E,
  timeoutMs = 2000,
): Promise<Parameters<ServerToClientEvents[E]>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Evento ${event} não chegou em ${timeoutMs}ms`)), timeoutMs);
    const listener = (...args: Parameters<ServerToClientEvents[E]>) => {
      clearTimeout(timer);
      resolve(args);
    };
    // O TypeScript não consegue relacionar um evento genérico E ao listener dele.
    // A assinatura de nextEvent já garante o tipo, então aqui usamos a visão sem tipos do mesmo socket.
    const untyped: Socket = client;
    untyped.once(event as string, listener);
  });
}