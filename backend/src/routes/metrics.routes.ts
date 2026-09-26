import type { ServerMetrics } from '@screenify/shared';
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../utils/app-error.js';

/** Compara em tempo constante: a resposta não revela quantos caracteres do token estavam certos */
function sameToken(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /metrics: estado do servidor para acompanhar produção.
 * Exige o METRICS_TOKEN no cabeçalho Authorization; os números não são públicos.
 */
export function createMetricsRouter(token: string, collect: () => Promise<ServerMetrics>): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const header = req.headers.authorization ?? '';
    if (!sameToken(header, `Bearer ${token}`)) {
      throw AppError.unauthorized();
    }
    res.set('Cache-Control', 'no-store').json(await collect());
  });

  return router;
}