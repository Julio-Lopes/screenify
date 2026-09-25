import { Router } from 'express';
import { isDatabaseReachable } from '../database/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/ready', async (_req, res) => {
  const databaseUp = await isDatabaseReachable();

  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? 'ok' : 'unavailable',
    database: databaseUp ? 'up' : 'down',
  });
});