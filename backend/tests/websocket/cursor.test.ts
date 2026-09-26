import type { RoomSummary } from '@screenify/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGuest, createRoom } from '../helpers/api.js';
import { resetDatabase } from '../helpers/database.js';
import { joinRoom, nextEvent, startTestServer, type TestClient, type TestServer } from '../helpers/test-server.js';

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

async function enter(room: RoomSummary, token: string): Promise<TestClient> {
  const client = await server.connect(token);
  const result = await joinRoom(client, { code: room.code });
  if (!result.ok) throw new Error(result.message);
  return client;
}

async function setup() {
  const host = await createGuest(server.app, 'Julio');
  const guest = await createGuest(server.app, 'Maria');
  const room = await createRoom(server.app, host.token);
  return { guest, hostClient: await enter(room, host.token), guestClient: await enter(room, guest.token) };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('cursores', () => {
  it('repassa a posição com quem é o dono do cursor', async () => {
    const { guest, hostClient, guestClient } = await setup();

    const moved = nextEvent(hostClient, 'cursor:moved');
    guestClient.emit('cursor:move', { x: 0.25, y: 0.4 });
    expect((await moved)[0]).toEqual({ userId: guest.user.id, x: 0.25, y: 0.4 });
  });

  it('avisa quando o cursor sai da tela', async () => {
    const { guest, hostClient, guestClient } = await setup();

    const left = nextEvent(hostClient, 'cursor:left');
    guestClient.emit('cursor:leave');
    expect((await left)[0]).toEqual({ userId: guest.user.id });
  });

  it('descarta posições fora da tela e o excesso de mensagens', async () => {
    const { hostClient, guestClient } = await setup();
    const received: unknown[] = [];
    hostClient.on('cursor:moved', (position) => received.push(position));

    guestClient.emit('cursor:move', { x: 2, y: 0.5 });
    // Dez posições de uma vez, bem mais rápido que o permitido
    for (let i = 0; i < 10; i++) guestClient.emit('cursor:move', { x: i / 10, y: 0.5 });
    await wait(200);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received.length).toBeLessThan(10);
    expect(received).not.toContainEqual(expect.objectContaining({ x: 2 }));
  });
});