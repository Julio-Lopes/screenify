import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { createGuest, createRoom } from '../helpers/api.js';
import { resetDatabase } from '../helpers/database.js';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

describe('POST /users/guest', () => {
  it('cria o convidado e devolve um token que não fica salvo em texto puro', async () => {
    const response = await request(app).post('/users/guest').send({ displayName: '  Julio  ' }).expect(201);

    expect(response.body.user.displayName).toBe('Julio');
    expect(response.body.token).toEqual(expect.any(String));

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: response.body.user.id } });
    expect(stored.sessionTokenHash).toHaveLength(64);
    expect(stored.sessionTokenHash).not.toBe(response.body.token);
  });

  it.each([
    [{}, 'O nome é obrigatório'],
    [{ displayName: '   ' }, 'O nome não pode ficar vazio'],
    [{ displayName: 'a'.repeat(41) }, 'O nome pode ter no máximo 40 caracteres'],
    [{ displayName: 'a\u0000b' }, 'O nome contém caracteres inválidos'],
  ])('recusa nome inválido %#', async (body, message) => {
    const response = await request(app).post('/users/guest').send(body).expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details.displayName).toContain(message);
  });

  it('responde 400 para JSON malformado', async () => {
    const response = await request(app)
      .post('/users/guest')
      .set('Content-Type', 'application/json')
      .send('{malformado')
      .expect(400);

    expect(response.body.error).toBe('BAD_REQUEST');
  });
});

describe('POST /rooms', () => {
  it('exige sessão', async () => {
    await request(app).post('/rooms').expect(401);
    await request(app).post('/rooms').set('Authorization', 'Bearer token-falso').expect(401);
  });

  it('cria sala com nome padrão, sem senha e vazia', async () => {
    const { token, user } = await createGuest(app, 'Julio');
    const room = await createRoom(app, token);

    expect(room).toMatchObject({
      name: 'Sala de Julio',
      host: { id: user.id, displayName: 'Julio' },
      hasPassword: false,
      participantCount: 0,
    });
    expect(room.code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);

    const stored = await prisma.room.findUniqueOrThrow({ where: { code: room.code } });
    expect(stored.emptySince).not.toBeNull();
  });

  it('cria sala com senha sem expor o hash', async () => {
    const { token } = await createGuest(app);
    const response = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sala de design', password: 'segredo' })
      .expect(201);

    expect(response.body.room.hasPassword).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('scrypt');
  });

  it('valida nome e senha', async () => {
    const { token } = await createGuest(app);
    const response = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', password: '12' })
      .expect(400);

    expect(Object.keys(response.body.details)).toEqual(expect.arrayContaining(['name', 'password']));
  });
});

describe('GET /rooms/:code', () => {
  it('encontra a sala mesmo com o código em minúsculas', async () => {
    const { token } = await createGuest(app);
    const room = await createRoom(app, token, { name: 'Sala de design' });

    const response = await request(app).get(`/rooms/${room.code.toLowerCase()}`).expect(200);
    expect(response.body.room.name).toBe('Sala de design');
  });

  it('diferencia código inválido de sala inexistente', async () => {
    await request(app).get('/rooms/abc').expect(400);
    await request(app).get('/rooms/AAAA-BBBB').expect(404);
  });
});

describe('DELETE /rooms/:code', () => {
  it('só o criador pode excluir', async () => {
    const host = await createGuest(app, 'Julio');
    const other = await createGuest(app, 'Maria');
    const room = await createRoom(app, host.token);

    await request(app).delete(`/rooms/${room.code}`).set('Authorization', `Bearer ${other.token}`).expect(403);
    await request(app).delete(`/rooms/${room.code}`).set('Authorization', `Bearer ${host.token}`).expect(204);
    await request(app).get(`/rooms/${room.code}`).expect(404);
  });
});