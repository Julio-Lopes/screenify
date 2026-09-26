import type { ApiErrorBody } from '@screenify/shared';
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

function limiter(windowMinutes: number, limit: number, message: string): RateLimitRequestHandler {
  return rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    // Cabeçalhos RateLimit padrão: o cliente sabe quanto falta e quando o limite volta
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      const body: ApiErrorBody = { error: 'TOO_MANY_REQUESTS', message };
      res.status(429).json(body);
    },
  });
}

/**
 * Limites por IP. Cada app tem os seus contadores (em memória, o que basta para um servidor).
 * Os valores ficam bem acima do uso de uma pessoa real e abaixo do que um script conseguiria.
 */
export function createRateLimiters() {
  return {
    /** Toda a API: 120 requisições por minuto */
    api: limiter(1, 120, 'Muitas requisições. Aguarde um instante e tente de novo.'),
    /** Criar convidado grava no banco: 20 a cada 15 minutos */
    createGuest: limiter(15, 20, 'Muitas sessões criadas deste endereço. Tente de novo em alguns minutos.'),
    /** Criar sala grava no banco e calcula hash de senha: 20 a cada 15 minutos */
    createRoom: limiter(15, 20, 'Muitas salas criadas deste endereço. Tente de novo em alguns minutos.'),
  };
}

export type RateLimiters = ReturnType<typeof createRateLimiters>;