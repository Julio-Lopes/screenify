import type { RoomResponse } from '@screenify/shared';
import type { Request, Response } from 'express';
import { getAuthUser } from '../middleware/authenticate.js';
import { createRoomSchema, roomCodeParamsSchema } from '../schemas/room.schemas.js';
import { createRoom, deleteRoom, findRoomByCode } from '../services/room.service.js';
import { notifyRoomDeleted } from '../websocket/socket-server.js';

export async function createRoomHandler(req: Request, res: Response<RoomResponse>): Promise<void> {
  const user = getAuthUser(req);
  const input = createRoomSchema.parse(req.body ?? {});
  const room = await createRoom(user, input);

  res.status(201).json({ room });
}

export async function getRoomHandler(req: Request, res: Response<RoomResponse>): Promise<void> {
  const { code } = roomCodeParamsSchema.parse(req.params);
  const room = await findRoomByCode(code);

  res.status(200).json({ room });
}

export async function deleteRoomHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const { code } = roomCodeParamsSchema.parse(req.params);
  const roomId = await deleteRoom(code, user.id);
  notifyRoomDeleted(roomId);

  res.status(204).end();
}