import type { ServerMetrics } from '@screenify/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createGuest, createRoom } from '../helpers/api.js';
import { resetDatabase } from '../helpers/database.js';
import { VP8_RTP_PARAMETERS } from '../helpers/media-fixtures.js';
import { joinRoom, startTestServer, type TestServer } from '../helpers/test-server.js';

const TOKEN = process.env.METRICS_TOKEN ?? '';

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

describe('GET /metrics', () => {
  it('não existe sem um coletor configurado', async () => {
    await request(createApp()).get('/metrics').set('Authorization', `Bearer ${TOKEN}`).expect(404);
  });

  it('exige o token', async () => {
    await request(server.app).get('/metrics').expect(401);
    await request(server.app).get('/metrics').set('Authorization', 'Bearer token-errado').expect(401);
  });

  it('conta salas, participantes, mídia e o uso dos workers', async () => {
    const host = await createGuest(server.app, 'Julio');
    const room = await createRoom(server.app, host.token);
    const client = await server.connect(host.token);
    await joinRoom(client, { code: room.code });

    const transport = await client.emitWithAck('media:create-transport', { direction: 'send' });
    if (!transport.ok) throw new Error(transport.message);
    await client.emitWithAck('media:produce', {
      transportId: transport.data.id,
      kind: 'video',
      rtpParameters: VP8_RTP_PARAMETERS,
      source: 'screen',
    });

    const response = await request(server.app).get('/metrics').set('Authorization', `Bearer ${TOKEN}`).expect(200);
    const metrics = response.body as ServerMetrics;

    expect(metrics.rooms).toEqual({ active: 1, participants: 1 });
    expect(metrics.media).toEqual({ routers: 1, transports: 1, producers: 1, consumers: 0 });
    expect(metrics.workers).toHaveLength(1);
    expect(metrics.workers[0]?.pid).toEqual(expect.any(Number));
    expect(metrics.process.memoryMb).toBeGreaterThan(0);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});