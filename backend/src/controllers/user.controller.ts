import type { Request, Response } from 'express';
import { createGuestSchema } from '../schemas/user.schemas.js';
import { createGuest } from '../services/user.service.js';

export async function createGuestHandler(req: Request, res: Response): Promise<void> {
  const input = createGuestSchema.parse(req.body ?? {});
  const { user, token } = await createGuest(input);

  res.status(201).json({ user, token });
}