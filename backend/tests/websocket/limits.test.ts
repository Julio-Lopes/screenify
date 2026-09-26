import type { RoomSummary } from '@screenify/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONNECTION_LIMITS, MAX_MESSAGE_BYTES } from '../../src/websocket/socket-limits.js';
import { createGuest, createRoom } from '../helpers/api.js';
import { resetDatabase } from '../helpers/database.js';
import { joinRoom, startTestServer, type TestClient, type TestServer } from '../helpers/test-server.js';

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  await resetDatabase();
});

/** O "disconnect" é um evento do próprio Socket.IO, não do contrato da sala */
function disconnection(client: TestClient): Promise<string> {
  return new Promise((resolve) => client.once('disconnect', (reason) => resolve(reason)));
}

async function enter(): Promise<{ client: TestClient; room: RoomSummary }> {
  const host = await createGuest(server.app, 'Julio');
  const room = await createRoom(server.app, host.token);
  const client = await server.connect(host.token);
  await joinRoom(client, { code: room.code });
  return { client, room };
}

describe('limites do WebSocket', () => {
  it('derruba quem inunda o servidor de mensagens', async () => {
    const { client } = await enter();

    const disconnected = disconnection(client);
    for (let i = 0; i < 1000; i++) client.emit('cursor:move', { x: 0.5, y: 0.5 });

    expect(await disconnected).toBe('io server disconnect');
  });

  it('fecha a conexão que manda uma mensagem grande demais', async () => {
    const { client } = await enter();

    const disconnected = disconnection(client);
    client.emit('drawing:remove', { ids: ['x'.repeat(MAX_MESSAGE_BYTES + 1024)] });

    expect(await disconnected).toBe('transport close');
  });

  it(`aceita até ${CONNECTION_LIMITS.openPerIp} conexões abertas do mesmo endereço`, async () => {
    const guest = await createGuest(server.app, 'Maria');
    const clients: TestClient[] = [];
    for (let i = 0; i < CONNECTION_LIMITS.openPerIp; i++) {
      clients.push(await server.connect(guest.token));
    }

    await expect(server.connect(guest.token)).rejects.toThrow('TOO_MANY_CONNECTIONS');

    // Fechando uma, abre espaço para outra
    const first = clients[0];
    if (!first) throw new Error('Sem conexões');
    first.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(server.connect(guest.token)).resolves.toBeDefined();
  });
});