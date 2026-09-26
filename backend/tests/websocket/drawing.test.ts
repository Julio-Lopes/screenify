import { randomUUID } from 'node:crypto';
import type { RoomSummary, StartStrokePayload } from '@screenify/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGuest, createRoom } from '../helpers/api.js';
import { resetDatabase } from '../helpers/database.js';
import { VP8_RTP_PARAMETERS } from '../helpers/media-fixtures.js';
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

async function shareScreen(client: TestClient): Promise<string> {
  const transport = await client.emitWithAck('media:create-transport', { direction: 'send' });
  if (!transport.ok) throw new Error(transport.message);
  const produced = await client.emitWithAck('media:produce', {
    transportId: transport.data.id,
    kind: 'video',
    rtpParameters: VP8_RTP_PARAMETERS,
    source: 'screen',
  });
  if (!produced.ok) throw new Error(produced.message);
  return produced.data.producerId;
}

/** Sala com Julio transmitindo e Maria assistindo */
async function setup() {
  const host = await createGuest(server.app, 'Julio');
  const guest = await createGuest(server.app, 'Maria');
  const room = await createRoom(server.app, host.token);
  const hostClient = await enter(room, host.token);
  const guestClient = await enter(room, guest.token);
  const producerId = await shareScreen(hostClient);
  return { host, guest, room, hostClient, guestClient, producerId };
}

function newStroke(points = [{ x: 0.1, y: 0.2 }]): StartStrokePayload {
  return { id: randomUUID(), tool: 'pen', color: '#34D399', width: 4, opacity: 1, points };
}

/** Espera o servidor processar tudo que o cliente mandou antes (a ordem por conexão é garantida) */
const settle = (client: TestClient) => client.emitWithAck('drawing:sync');

describe('desenho em tempo real', () => {
  it('repassa início, pontos e fim do traço, com quem desenhou', async () => {
    const { guest, hostClient, guestClient } = await setup();
    const stroke = newStroke();

    const started = nextEvent(hostClient, 'drawing:started');
    guestClient.emit('drawing:start', stroke);
    expect((await started)[0]).toEqual({ ...stroke, userId: guest.user.id });

    const appended = nextEvent(hostClient, 'drawing:appended');
    guestClient.emit('drawing:append', { id: stroke.id, points: [{ x: 0.3, y: 0.4 }] });
    expect((await appended)[0]).toEqual({ id: stroke.id, points: [{ x: 0.3, y: 0.4 }] });

    const ended = nextEvent(hostClient, 'drawing:ended');
    guestClient.emit('drawing:end', { id: stroke.id });
    expect((await ended)[0]).toEqual({ id: stroke.id });
  });

  it('entrega a quem chega depois os traços prontos e os que estão sendo desenhados', async () => {
    const { host, guest, room, hostClient, guestClient } = await setup();
    const done = newStroke();
    const inProgress = newStroke([{ x: 0.5, y: 0.5 }]);

    guestClient.emit('drawing:start', done);
    guestClient.emit('drawing:append', { id: done.id, points: [{ x: 0.2, y: 0.3 }] });
    guestClient.emit('drawing:end', { id: done.id });
    hostClient.emit('drawing:start', inProgress);
    await settle(guestClient);
    await settle(hostClient);

    const other = await createGuest(server.app, 'Carlos');
    const late = await enter(room, other.token);
    const snapshot = await late.emitWithAck('drawing:sync');

    expect(snapshot.strokes).toEqual([
      { ...done, userId: guest.user.id, points: [{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }] },
    ]);
    expect(snapshot.active).toEqual([{ ...inProgress, userId: host.user.id }]);
  });

  it('descarta traços inválidos e não deixa ninguém mexer no traço de outra pessoa', async () => {
    const { hostClient, guestClient } = await setup();
    const stroke = newStroke();

    guestClient.emit('drawing:start', { ...stroke, color: 'red' });
    guestClient.emit('drawing:start', { ...newStroke(), points: [{ x: 1.5, y: 0 }] });
    guestClient.emit('drawing:start', stroke);
    // Julio tenta continuar e concluir o traço de Maria
    hostClient.emit('drawing:append', { id: stroke.id, points: [{ x: 0.9, y: 0.9 }] });
    hostClient.emit('drawing:end', { id: stroke.id });
    await settle(guestClient);
    await settle(hostClient);

    const snapshot = await guestClient.emitWithAck('drawing:sync');
    expect(snapshot.strokes).toEqual([]);
    expect(snapshot.active).toHaveLength(1);
    expect(snapshot.active[0]?.points).toEqual(stroke.points);
  });

  it('ignora desenhos quando ninguém está transmitindo', async () => {
    const host = await createGuest(server.app, 'Julio');
    const room = await createRoom(server.app, host.token);
    const client = await enter(room, host.token);

    client.emit('drawing:start', newStroke());
    expect(await client.emitWithAck('drawing:sync')).toEqual({ strokes: [], active: [] });
  });

  it('limpa os desenhos de todos quando a transmissão termina', async () => {
    const { hostClient, guestClient, producerId } = await setup();
    const stroke = newStroke();
    guestClient.emit('drawing:start', stroke);
    guestClient.emit('drawing:end', { id: stroke.id });
    await settle(guestClient);

    const cleared = nextEvent(guestClient, 'drawing:cleared');
    await hostClient.emitWithAck('media:close-producer', { producerId });
    await cleared;

    expect(await guestClient.emitWithAck('drawing:sync')).toEqual({ strokes: [], active: [] });
  });

  it('conclui o traço de quem sai da sala no meio do desenho', async () => {
    const { hostClient, guestClient } = await setup();
    const stroke = newStroke();
    guestClient.emit('drawing:start', stroke);
    await settle(guestClient);

    const ended = nextEvent(hostClient, 'drawing:ended');
    guestClient.disconnect();
    expect((await ended)[0]).toEqual({ id: stroke.id });

    const snapshot = await hostClient.emitWithAck('drawing:sync');
    expect(snapshot.strokes.map((s) => s.id)).toEqual([stroke.id]);
  });
});


describe('ferramentas', () => {
  it('guarda só o início e o fim das formas', async () => {
    const { guestClient } = await setup();
    const arrow = { ...newStroke([{ x: 0.1, y: 0.1 }]), tool: 'arrow' as const };

    guestClient.emit('drawing:start', arrow);
    guestClient.emit('drawing:append', { id: arrow.id, points: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }] });
    guestClient.emit('drawing:append', { id: arrow.id, points: [{ x: 0.4, y: 0.5 }] });
    guestClient.emit('drawing:end', { id: arrow.id });

    const snapshot = await settle(guestClient);
    expect(snapshot.strokes[0]?.points).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.5 }]);
  });

  it('aceita texto só na ferramenta de texto', async () => {
    const { guestClient } = await setup();
    const text = { ...newStroke(), tool: 'text' as const, text: 'Olha aqui' };

    guestClient.emit('drawing:start', { ...newStroke(), tool: 'text' as const });
    guestClient.emit('drawing:start', { ...newStroke(), text: 'texto numa caneta' });
    guestClient.emit('drawing:start', text);
    guestClient.emit('drawing:end', { id: text.id });

    const snapshot = await settle(guestClient);
    expect(snapshot.strokes).toHaveLength(1);
    expect(snapshot.strokes[0]?.text).toBe('Olha aqui');
  });
});

describe('remover e restaurar', () => {
  async function drawDone(client: TestClient) {
    const stroke = newStroke();
    client.emit('drawing:start', stroke);
    client.emit('drawing:end', { id: stroke.id });
    await settle(client);
    return stroke;
  }

  it('cada pessoa remove só os próprios traços; quem criou a sala remove qualquer um', async () => {
    const { hostClient, guestClient } = await setup();
    const hostStroke = await drawDone(hostClient);
    const guestStroke = await drawDone(guestClient);

    // Maria tenta apagar o traço de Julio: nada acontece
    guestClient.emit('drawing:remove', { ids: [hostStroke.id] });
    expect((await settle(guestClient)).strokes).toHaveLength(2);

    // Julio criou a sala: pode apagar o traço de Maria, e ela é avisada
    const removed = nextEvent(guestClient, 'drawing:removed');
    hostClient.emit('drawing:remove', { ids: [guestStroke.id] });
    expect((await removed)[0]).toEqual({ ids: [guestStroke.id] });
    expect((await settle(hostClient)).strokes.map((s) => s.id)).toEqual([hostStroke.id]);
  });

  it('restaura traços removidos (desfazer), respeitando a mesma regra', async () => {
    const { guest, host, hostClient, guestClient } = await setup();
    const guestStroke = await drawDone(guestClient);
    guestClient.emit('drawing:remove', { ids: [guestStroke.id] });
    await settle(guestClient);

    // Maria não pode "restaurar" um traço em nome de Julio
    const forged = { ...newStroke(), userId: host.user.id };
    guestClient.emit('drawing:restore', { strokes: [forged] });

    const restored = nextEvent(hostClient, 'drawing:restored');
    guestClient.emit('drawing:restore', { strokes: [{ ...guestStroke, userId: guest.user.id }] });
    expect((await restored)[0].strokes.map((s) => s.id)).toEqual([guestStroke.id]);

    expect((await settle(guestClient)).strokes.map((s) => s.id)).toEqual([guestStroke.id]);
  });
});