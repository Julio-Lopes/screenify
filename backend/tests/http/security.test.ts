import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { resetDatabase } from '../helpers/database.js';

beforeEach(async () => {
  await resetDatabase();
});

describe('segurança HTTP', () => {
  it('envia cabeçalhos de segurança e não anuncia a tecnologia do servidor', async () => {
    const response = await request(createApp()).get('/health').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('limita a criação de convidados por IP', async () => {
    const app = createApp({ rateLimits: true });

    for (let i = 0; i < 20; i++) {
      await request(app).post('/users/guest').send({ displayName: `Pessoa ${i}` }).expect(201);
    }
    const blocked = await request(app).post('/users/guest').send({ displayName: 'Mais uma' }).expect(429);

    expect(blocked.body.error).toBe('TOO_MANY_REQUESTS');
    expect(blocked.headers['ratelimit-policy']).toBeDefined();
  });

  it('recusa corpo maior que 100 KB', async () => {
    const response = await request(createApp())
      .post('/users/guest')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ displayName: 'a'.repeat(200_000) }))
      .expect(413);

    expect(response.body.error).toBe('BAD_REQUEST');
  });
});