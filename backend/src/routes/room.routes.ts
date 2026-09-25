import { Router } from 'express';
import {
  createRoomHandler,
  deleteRoomHandler,
  getRoomHandler,
} from '../controllers/room.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const roomRouter = Router();

roomRouter.post('/', authenticate, createRoomHandler);
roomRouter.get('/:code', getRoomHandler);
roomRouter.delete('/:code', authenticate, deleteRoomHandler);