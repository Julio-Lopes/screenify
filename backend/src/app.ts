import type { ServerMetrics } from '@screenify/shared';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { createRateLimiters } from './middleware/rate-limit.js';
import { healthRouter } from './routes/health.routes.js';
import { createMetricsRouter } from './routes/metrics.routes.js';
import { roomRouter } from './routes/room.routes.js';
import { userRouter } from './routes/user.routes.js';

interface AppOptions {
  /** Coletor de métricas; o endpoint só existe com ele e com o METRICS_TOKEN definido */
  metrics?: () => Promise<ServerMetrics>;
  /** Limites de requisição por IP. Ligados por padrão; os testes os desligam, exceto os que testam os limites */
  rateLimits?: boolean;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();

  // Atrás do proxy do Coolify, o IP real de quem acessa vem no X-Forwarded-For
  app.set('trust proxy', env.TRUST_PROXY);

  // Cabeçalhos de segurança HTTP; também remove o X-Powered-By, que anunciaria o Express
  app.use(helmet());

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);

  if (options.rateLimits ?? env.NODE_ENV !== 'test') {
    const limiters = createRateLimiters();
    app.use(['/users', '/rooms'], limiters.api);
    app.post('/users/guest', limiters.createGuest);
    app.post('/rooms', limiters.createRoom);
  }

  app.use('/users', userRouter);
  app.use('/rooms', roomRouter);

  if (options.metrics && env.METRICS_TOKEN) {
    app.use('/metrics', createMetricsRouter(env.METRICS_TOKEN, options.metrics));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}