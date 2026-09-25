import type { RoomSummary } from '@screenify/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/database/prisma.js';
import { createGuest, createRoom } from '../helpers/api.js';
import { eventually, resetDatabase } from '../helpers/database.js';
import { joinRoom, nextEvent, startTestServer, type TestServer } from '../helpers/test-server.js';

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

async function setupRoom(password?: string) {
  const host = await createGuest(server.app, 'Julio');
  const guest = await createGuest(server.app, 'Maria');
  const room: RoomSummary = await createRoom(server.app, host.token, password ? { password } : {});
  return { host, guest, room };
}

describe('autenticação da conexão', () => {
  it('recusa conexão sem token ou com token inválido', async () => {
    await expect(server.connect()).rejects.toThrow('UNAUTHORIZED');
    await expect(server.connect('token-falso')).rejects.toThrow('UNAUTHORIZED');
  });
});

describe('room:join', () => {
  it('o criador entra sem senha e recebe a si mesmo como HOST', async () => {
    const { host, room } = await setupRoom('segredo');
    const client = await server.connect(host.token);

    const result = await joinRoom(client, { code: room.code });

    expect(result).toMatchObject({ ok: true, self: { displayName: 'Julio', role: 'HOST' } });
    if (!result.ok) return;
    expect(result.participants).toHaveLength(1);
    expect(result.room.participantCount).toBe(1);

    const stored = await prisma.room.findUniqueOrThrow({ where: { code: room.code } });
    expect(stored.emptySince).toBeNull();
  });

  it('pede senha, recusa a errada e aceita a certa', async () => {
    const { guest, room } = await setupRoom('segredo');
    const client = await server.connect(guest.token);

    expect(await joinRoom(client, { code: room.code })).toMatchObject({ ok: false, error: 'PASSWORD_REQUIRED' });
    expect(await joinRoom(client, { code: room.code, password: 'errada' })).toMatchObject({
      ok: false,
      error: 'WRONG_PASSWORD',
    });
    expect(await joinRoom(client, { code: room.code, password: 'segredo' })).toMatchObject({ ok: true });
  });

  it('bloqueia depois de 5 senhas erradas, mesmo reconectando', async () => {
    const { guest, room } = await setupRoom('segredo');
    const first = await server.connect(guest.token);

    for (let i = 0; i < 5; i++) {
      await joinRoom(first, { code: room.code, password: 'errada' });
    }
    first.disconnect();

    const second = await server.connect(guest.token);
    expect(await joinRoom(second, { code: room.code, password: 'segredo' })).toMatchObject({
      ok: false,
      error: 'TOO_MANY_ATTEMPTS',
    });
  });

  it('quem já entrou uma vez não precisa digitar a senha de novo', async () => {
    const { guest, room } = await setupRoom('segredo');
    const first = await server.connect(guest.token);
    await joinRoom(first, { code: room.code, password: 'segredo' });
    first.disconnect();

    const second = await server.connect(guest.token);
    expect(await joinRoom(second, { code: room.code })).toMatchObject({ ok: true });
  });

  it('recusa payload inválido e sala inexistente', async () => {
    const { guest } = await setupRoom();
    const client = await server.connect(guest.token);

    expect(await joinRoom(client, { code: 'x' })).toMatchObject({ ok: false, error: 'INVALID_PAYLOAD' });
    expect(await joinRoom(client, { code: 'AAAA-BBBB' })).toMatchObject({ ok: false, error: 'ROOM_NOT_FOUND' });
  });
});

describe('presença', () => {
  it('avisa quem já está na sala quando alguém entra e quando sai', async () => {
    const { host, guest, room } = await setupRoom();
    const hostClient = await server.connect(host.token);
    await joinRoom(hostClient, { code: room.code });

    const guestClient = await server.connect(guest.token);
    const joined = nextEvent(hostClient, 'room:participant-joined');
    const result = await joinRoom(guestClient, { code: room.code });

    const [participant] = await joined;
    expect(participant).toMatchObject({ displayName: 'Maria', role: 'PARTICIPANT' });
    expect(result.ok && result.participants.map((p) => p.displayName).sort()).toEqual(['Julio', 'Maria']);

    // Cada pessoa tem uma cor diferente
    expect(result.ok && new Set(result.participants.map((p) => p.color)).size).toBe(2);

    const left = nextEvent(hostClient, 'room:participant-left');
    guestClient.disconnect();
    const [payload] = await left;
    expect(payload.userId).toBe(guest.user.id);
  });

  it('registra saída no banco e marca a sala como vazia quando o último sai', async () => {
    const { host, room } = await setupRoom();
    const client = await server.connect(host.token);
    await joinRoom(client, { code: room.code });

    client.disconnect();

    await eventually(async () => {
      const stored = await prisma.room.findUniqueOrThrow({
        where: { code: room.code },
        include: { participants: true },
      });
      expect(stored.emptySince).not.toBeNull();
      expect(stored.participants[0]?.leftAt).not.toBeNull();
    });
  });

  it('a mesma pessoa em outra aba substitui a conexão antiga sem virar participante duplicado', async () => {
    const { host, guest, room } = await setupRoom();
    const hostClient = await server.connect(host.token);
    await joinRoom(hostClient, { code: room.code });

    const firstTab = await server.connect(guest.token);
    await joinRoom(firstTab, { code: room.code });

    const secondTab = await server.connect(guest.token);
    const replaced = nextEvent(firstTab, 'room:session-replaced');
    const result = await joinRoom(secondTab, { code: room.code });
    await replaced;

    expect(result.ok && result.participants).toHaveLength(2);

    // A aba antiga caindo não pode tirar a pessoa da sala
    let leftAnnounced = false;
    hostClient.on('room:participant-left', () => {
      leftAnnounced = true;
    });
    firstTab.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(leftAnnounced).toBe(false);

    const openParticipations = await prisma.roomParticipant.count({ where: { leftAt: null } });
    expect(openParticipations).toBe(2);
  });

  it('avisa todos quando o criador exclui a sala', async () => {
    const { host, guest, room } = await setupRoom();
    const hostClient = await server.connect(host.token);
    const guestClient = await server.connect(guest.token);
    await joinRoom(hostClient, { code: room.code });
    await joinRoom(guestClient, { code: room.code });

    const closed = nextEvent(guestClient, 'room:closed');
    await request(server.app).delete(`/rooms/${room.code}`).set('Authorization', `Bearer ${host.token}`).expect(204);

    const [payload] = await closed;
    expect(payload.reason).toBe('DELETED_BY_HOST');
  });
});