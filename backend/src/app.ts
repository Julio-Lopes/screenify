import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import type { ServerMetrics } from '@screenify/shared';
import { healthRouter } from './routes/health.routes.js';
import { createMetricsRouter } from './routes/metrics.routes.js';
import { roomRouter } from './routes/room.routes.js';
import { userRouter } from './routes/user.routes.js';

interface AppOptions {
  /** Coletor de métricas; o endpoint só existe com ele e com o METRICS_TOKEN definido */
  metrics?: () => Promise<ServerMetrics>;
}

export function createApp(options: AppOptions = {}): express.Express {
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
  app.use('/users', userRouter);
  app.use('/rooms', roomRouter);

  if (options.metrics && env.METRICS_TOKEN) {
    app.use('/metrics', createMetricsRouter(env.METRICS_TOKEN, options.metrics));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}