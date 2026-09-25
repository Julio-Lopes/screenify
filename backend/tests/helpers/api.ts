import type { GuestSessionResponse, RoomSummary } from '@screenify/shared';
import type { Express } from 'express';
import request from 'supertest';

export async function createGuest(app: Express, displayName = 'Julio'): Promise<GuestSessionResponse> {
  const response = await request(app).post('/users/guest').send({ displayName }).expect(201);
  return response.body as GuestSessionResponse;
}

export async function createRoom(
  app: Express,
  token: string,
  body: { name?: string; password?: string } = {},
): Promise<RoomSummary> {
  const response = await request(app)
    .post('/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(201);
  return (response.body as { room: RoomSummary }).room;
}