import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { healthRouter } from './routes/health.routes.js';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}