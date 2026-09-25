import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('health', () => {
  it('GET /health responde que o processo está vivo', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready confirma a conexão com o banco', async () => {
    const response = await request(app).get('/health/ready').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('libera CORS só para a origem do frontend', async () => {
    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const blocked = await request(app).get('/health').set('Origin', 'http://site-malicioso.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responde 404 em JSON para rota inexistente', async () => {
    const response = await request(app).get('/nao-existe').expect(404);
    expect(response.body.error).toBe('NOT_FOUND');
  });
});