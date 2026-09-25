import { randomUUID } from 'node:crypto';
import type { RoomSummary } from '@screenify/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { createGuest, createRoom } from '../helpers/api.js';
import { resetDatabase } from '../helpers/database.js';
import { FAKE_DTLS_PARAMETERS, VP8_RTP_PARAMETERS } from '../helpers/media-fixtures.js';
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

/** Conecta e entra na sala */
async function enter(room: RoomSummary, token: string): Promise<TestClient> {
  const client = await server.connect(token);
  const result = await joinRoom(client, { code: room.code });
  expect(result.ok).toBe(true);
  return client;
}

async function setup() {
  const host = await createGuest(server.app, 'Julio');
  const guest = await createGuest(server.app, 'Maria');
  const room = await createRoom(server.app, host.token);
  return { host, guest, room };
}

/** Cria o transport de envio e publica uma tela; devolve o id do producer */
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

describe('antes de entrar na sala', () => {
  it('recusa pedidos de mídia', async () => {
    const { host } = await setup();
    const client = await server.connect(host.token);

    expect(await client.emitWithAck('media:get-rtp-capabilities')).toMatchObject({
      ok: false,
      error: 'NOT_IN_ROOM',
    });
  });
});

describe('Router', () => {
  it('oferece VP8, VP9, H264 e Opus', async () => {
    const { host, room } = await setup();
    const client = await enter(room, host.token);

    const result = await client.emitWithAck('media:get-rtp-capabilities');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const mimeTypes = result.data.codecs?.map((codec) => codec.mimeType) ?? [];
    expect(mimeTypes).toEqual(expect.arrayContaining(['video/VP8', 'video/VP9', 'video/H264', 'audio/opus']));
  });
});

describe('WebRtcTransport', () => {
  it('anuncia o IP e a porta configurados, em UDP e TCP', async () => {
    const { host, room } = await setup();
    const client = await enter(room, host.token);

    const result = await client.emitWithAck('media:create-transport', { direction: 'send' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const candidates = result.data.iceCandidates;
    expect(candidates.map((c) => c.protocol).sort()).toEqual(['tcp', 'udp']);
    for (const candidate of candidates) {
      expect(candidate.address).toBe(env.MEDIASOUP_ANNOUNCED_IP);
      expect(candidate.port).toBe(env.MEDIASOUP_MIN_PORT);
    }
  });

  it('conecta com parâmetros DTLS válidos e recusa transport desconhecido ou dados inválidos', async () => {
    const { host, room } = await setup();
    const client = await enter(room, host.token);
    const transport = await client.emitWithAck('media:create-transport', { direction: 'send' });
    if (!transport.ok) throw new Error(transport.message);

    expect(
      await client.emitWithAck('media:connect-transport', {
        transportId: transport.data.id,
        dtlsParameters: FAKE_DTLS_PARAMETERS,
      }),
    ).toEqual({ ok: true, data: null });

    expect(
      await client.emitWithAck('media:connect-transport', {
        transportId: randomUUID(),
        dtlsParameters: FAKE_DTLS_PARAMETERS,
      }),
    ).toMatchObject({ ok: false, error: 'TRANSPORT_NOT_FOUND' });

    expect(
      await client.emitWithAck('media:create-transport', { direction: 'sideways' as 'send' }),
    ).toMatchObject({ ok: false, error: 'INVALID_PAYLOAD' });
  });

  it('não deixa uma pessoa usar o transport de outra', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);

    const transport = await hostClient.emitWithAck('media:create-transport', { direction: 'send' });
    if (!transport.ok) throw new Error(transport.message);

    expect(
      await guestClient.emitWithAck('media:produce', {
        transportId: transport.data.id,
        kind: 'video',
        rtpParameters: VP8_RTP_PARAMETERS,
        source: 'screen',
      }),
    ).toMatchObject({ ok: false, error: 'TRANSPORT_NOT_FOUND' });
  });
});

describe('Producer', () => {
  it('avisa a sala quando alguém começa a transmitir', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);

    const added = nextEvent(guestClient, 'media:producer-added');
    const producerId = await shareScreen(hostClient);

    const [producer] = await added;
    expect(producer).toEqual({ producerId, userId: host.user.id, kind: 'video', source: 'screen' });

    const list = await guestClient.emitWithAck('media:list-producers');
    expect(list).toEqual({ ok: true, data: [producer] });
  });

  it('permite só uma tela por sala', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);
    await shareScreen(hostClient);

    await expect(shareScreen(guestClient)).rejects.toThrow('Outra pessoa já está compartilhando a tela');
  });

  it('recusa transmitir por um transport de recebimento', async () => {
    const { host, room } = await setup();
    const client = await enter(room, host.token);
    const transport = await client.emitWithAck('media:create-transport', { direction: 'recv' });
    if (!transport.ok) throw new Error(transport.message);

    expect(
      await client.emitWithAck('media:produce', {
        transportId: transport.data.id,
        kind: 'video',
        rtpParameters: VP8_RTP_PARAMETERS,
        source: 'screen',
      }),
    ).toMatchObject({ ok: false, error: 'TRANSPORT_NOT_FOUND' });
  });

  it('recusa codec que o Router não suporta', async () => {
    const { host, room } = await setup();
    const client = await enter(room, host.token);
    const transport = await client.emitWithAck('media:create-transport', { direction: 'send' });
    if (!transport.ok) throw new Error(transport.message);

    const vp8 = VP8_RTP_PARAMETERS.codecs[0];
    if (!vp8) throw new Error('Fixture sem codec');
    expect(
      await client.emitWithAck('media:produce', {
        transportId: transport.data.id,
        kind: 'video',
        rtpParameters: { ...VP8_RTP_PARAMETERS, codecs: [{ ...vp8, mimeType: 'video/AV2' }] },
        source: 'screen',
      }),
    ).toMatchObject({ ok: false, error: 'INVALID_PAYLOAD' });
  });

  it('libera a tela quando a transmissão para ou quando quem transmite sai', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);

    const producerId = await shareScreen(hostClient);
    const stopped = nextEvent(guestClient, 'media:producer-closed');
    expect(await hostClient.emitWithAck('media:close-producer', { producerId })).toEqual({ ok: true, data: null });
    expect((await stopped)[0]).toEqual({ producerId });

    // Agora Maria pode transmitir; quando ela sai, Julio é avisado
    const guestProducerId = await shareScreen(guestClient);
    const left = nextEvent(hostClient, 'media:producer-closed');
    guestClient.disconnect();
    expect((await left)[0]).toEqual({ producerId: guestProducerId });

    expect(await hostClient.emitWithAck('media:list-producers')).toEqual({ ok: true, data: [] });
  });

  it('encerra a transmissão da aba antiga quando a pessoa abre outra aba', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const firstTab = await enter(room, guest.token);
    const producerId = await shareScreen(firstTab);

    const closed = nextEvent(hostClient, 'media:producer-closed');
    await enter(room, guest.token);

    expect((await closed)[0]).toEqual({ producerId });
  });
});

describe('Consumer', () => {
  it('entrega a transmissão pausada e libera quando pedido', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);
    const producerId = await shareScreen(hostClient);

    const capabilities = await guestClient.emitWithAck('media:get-rtp-capabilities');
    if (!capabilities.ok) throw new Error(capabilities.message);

    // Sem transport de recebimento ainda
    expect(
      await guestClient.emitWithAck('media:consume', { producerId, rtpCapabilities: capabilities.data }),
    ).toMatchObject({ ok: false, error: 'TRANSPORT_NOT_FOUND' });

    await guestClient.emitWithAck('media:create-transport', { direction: 'recv' });
    const consumer = await guestClient.emitWithAck('media:consume', {
      producerId,
      rtpCapabilities: capabilities.data,
    });

    expect(consumer).toMatchObject({ ok: true, data: { producerId, kind: 'video' } });
    if (!consumer.ok) return;
    expect(consumer.data.rtpParameters.codecs[0]?.mimeType).toBe('video/VP8');

    expect(await guestClient.emitWithAck('media:resume-consumer', { consumerId: consumer.data.id })).toEqual({
      ok: true,
      data: null,
    });
    expect(await guestClient.emitWithAck('media:resume-consumer', { consumerId: randomUUID() })).toMatchObject({
      ok: false,
      error: 'CONSUMER_NOT_FOUND',
    });
  });
});