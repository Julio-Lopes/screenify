import { Router } from 'express';
import { createGuestHandler } from '../controllers/user.controller.js';

export const userRouter = Router();

userRouter.post('/guest', createGuestHandler);