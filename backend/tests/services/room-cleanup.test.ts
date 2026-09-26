import type { RoomSummary } from '@screenify/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/database/prisma.js';
import { RoomCleanupService } from '../../src/services/room-cleanup.service.js';
import { createGuest, createRoom } from '../helpers/api.js';
import { eventually, resetDatabase } from '../helpers/database.js';
import { joinRoom, startTestServer, type TestServer } from '../helpers/test-server.js';

const TEN_MINUTES = 10 * 60 * 1000;

let server: TestServer;
const media = { close: vi.fn(async () => undefined) };
const cleanup = new RoomCleanupService(TEN_MINUTES, media);

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  await resetDatabase();
  media.close.mockClear();
});

async function newRoom(): Promise<{ room: RoomSummary; token: string }> {
  const host = await createGuest(server.app, 'Julio');
  return { room: await createRoom(server.app, host.token), token: host.token };
}

/** Faz a sala parecer vazia desde X minutos atrás */
async function emptyFor(room: RoomSummary, minutes: number) {
  await prisma.room.update({
    where: { code: room.code },
    data: { emptySince: new Date(Date.now() - minutes * 60 * 1000) },
  });
}

const exists = async (room: RoomSummary) => (await prisma.room.count({ where: { code: room.code } })) === 1;

describe('RoomCleanupService', () => {
  it('exclui a sala vazia há mais de 10 minutos, junto com o histórico de participantes', async () => {
    const { room, token } = await newRoom();
    const client = await server.connect(token);
    await joinRoom(client, { code: room.code });
    client.disconnect();
    await eventually(async () => {
      expect((await prisma.room.findUniqueOrThrow({ where: { code: room.code } })).emptySince).not.toBeNull();
    });
    await emptyFor(room, 11);

    expect(await cleanup.runOnce()).toEqual([room.code]);
    expect(await exists(room)).toBe(false);
    expect(await prisma.roomParticipant.count()).toBe(0);
    expect(media.close).toHaveBeenCalledTimes(1);
  });

  it('mantém a sala vazia há menos de 10 minutos', async () => {
    const { room } = await newRoom();
    await emptyFor(room, 9);

    expect(await cleanup.runOnce()).toEqual([]);
    expect(await exists(room)).toBe(true);
  });

  it('entrar cancela a contagem: sala ocupada nunca expira', async () => {
    const { room, token } = await newRoom();
    await emptyFor(room, 11);

    const client = await server.connect(token);
    await joinRoom(client, { code: room.code });

    expect(await cleanup.runOnce()).toEqual([]);
    expect(await exists(room)).toBe(true);
  });

  it('a contagem vale mesmo com o horário vindo de antes de um reinício', async () => {
    // Sala criada e nunca usada: nasce vazia (Fase 5), e o prazo corre a partir da criação
    const { room } = await newRoom();

    expect(await cleanup.runOnce(new Date(Date.now() + TEN_MINUTES - 1000))).toEqual([]);
    expect(await cleanup.runOnce(new Date(Date.now() + TEN_MINUTES + 1000))).toEqual([room.code]);
  });

  it('verifica com frequência proporcional ao prazo', () => {
    expect(new RoomCleanupService(TEN_MINUTES, media).intervalMs).toBe(30_000);
    expect(new RoomCleanupService(20_000, media).intervalMs).toBe(5_000);
  });
});