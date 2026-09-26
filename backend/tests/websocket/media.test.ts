import { randomUUID } from 'node:crypto';
import type { RoomSummary } from '@screenify/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { createGuest, createRoom } from '../helpers/api.js';
import { resetDatabase } from '../helpers/database.js';
import {
  FAKE_DTLS_PARAMETERS,
  VP8_RTP_PARAMETERS,
  VP8_SIMULCAST_RTP_PARAMETERS,
} from '../helpers/media-fixtures.js';
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
async function shareScreen(client: TestClient, rtpParameters = VP8_RTP_PARAMETERS): Promise<string> {
  const transport = await client.emitWithAck('media:create-transport', { direction: 'send' });
  if (!transport.ok) throw new Error(transport.message);

  const produced = await client.emitWithAck('media:produce', {
    transportId: transport.data.id,
    kind: 'video',
    rtpParameters,
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
    expect(producer).toEqual({ producerId, userId: host.user.id, kind: 'video', source: 'screen', quality: null, target: null });

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

describe('Simulcast', () => {
  async function watch(viewer: TestClient, producerId: string) {
    const capabilities = await viewer.emitWithAck('media:get-rtp-capabilities');
    if (!capabilities.ok) throw new Error(capabilities.message);
    await viewer.emitWithAck('media:create-transport', { direction: 'recv' });
    const consumer = await viewer.emitWithAck('media:consume', { producerId, rtpCapabilities: capabilities.data });
    if (!consumer.ok) throw new Error(consumer.message);
    return consumer.data;
  }

  it('entrega camadas escolhíveis quando a transmissão é simulcast', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);
    const producerId = await shareScreen(hostClient, VP8_SIMULCAST_RTP_PARAMETERS);

    const consumer = await watch(guestClient, producerId);
    expect(consumer.simulcast).toBe(true);

    for (const spatialLayer of [0, 1, 2]) {
      expect(
        await guestClient.emitWithAck('media:set-preferred-layers', { consumerId: consumer.id, spatialLayer }),
      ).toEqual({ ok: true, data: null });
    }
    expect(
      await guestClient.emitWithAck('media:set-preferred-layers', { consumerId: consumer.id, spatialLayer: 7 }),
    ).toMatchObject({ ok: false, error: 'INVALID_PAYLOAD' });
  });

  it('recusa escolher camada numa transmissão de qualidade única', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);
    const producerId = await shareScreen(hostClient);

    const consumer = await watch(guestClient, producerId);
    expect(consumer.simulcast).toBe(false);
    expect(
      await guestClient.emitWithAck('media:set-preferred-layers', { consumerId: consumer.id, spatialLayer: 0 }),
    ).toMatchObject({ ok: false, error: 'INVALID_PAYLOAD' });
  });
});


describe('Qualidade informada por quem transmite', () => {
  const FULL_HD = { width: 1920, height: 1080, frameRate: 30 };
  const TARGET_1080P = { height: 1080, frameRate: 30 };

  it('chega a quem assiste na criação, nas atualizações e na lista', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);

    const transport = await hostClient.emitWithAck('media:create-transport', { direction: 'send' });
    if (!transport.ok) throw new Error(transport.message);

    const added = nextEvent(guestClient, 'media:producer-added');
    const produced = await hostClient.emitWithAck('media:produce', {
      transportId: transport.data.id,
      kind: 'video',
      rtpParameters: VP8_SIMULCAST_RTP_PARAMETERS,
      source: 'screen',
      quality: FULL_HD,
      target: TARGET_1080P,
    });
    if (!produced.ok) throw new Error(produced.message);
    expect((await added)[0]).toMatchObject({ quality: FULL_HD, target: TARGET_1080P });

    // A captura oscilou (comum ao compartilhar uma aba), mas a qualidade escolhida continua 1080p
    const OSCILLATED = { width: 1518, height: 854, frameRate: 60 };
    const TARGET_1080P60 = { height: 1080, frameRate: 60 };
    const changed = nextEvent(guestClient, 'media:producer-quality');
    expect(
      await hostClient.emitWithAck('media:update-producer-quality', {
        producerId: produced.data.producerId,
        quality: OSCILLATED,
        target: TARGET_1080P60,
      }),
    ).toEqual({ ok: true, data: null });
    expect((await changed)[0]).toEqual({
      producerId: produced.data.producerId,
      quality: OSCILLATED,
      target: TARGET_1080P60,
    });

    const list = await guestClient.emitWithAck('media:list-producers');
    expect(list.ok && list.data[0]).toMatchObject({ quality: OSCILLATED, target: TARGET_1080P60 });
  });

  it('só quem transmite pode informar a qualidade, e com valores válidos', async () => {
    const { host, guest, room } = await setup();
    const hostClient = await enter(room, host.token);
    const guestClient = await enter(room, guest.token);
    const producerId = await shareScreen(hostClient);

    expect(
      await guestClient.emitWithAck('media:update-producer-quality', { producerId, quality: FULL_HD, target: TARGET_1080P }),
    ).toMatchObject({ ok: false, error: 'PRODUCER_NOT_FOUND' });

    expect(
      await hostClient.emitWithAck('media:update-producer-quality', {
        producerId,
        quality: { width: -1, height: 1080, frameRate: 30 },
        target: TARGET_1080P,
      }),
    ).toMatchObject({ ok: false, error: 'INVALID_PAYLOAD' });
  });
});