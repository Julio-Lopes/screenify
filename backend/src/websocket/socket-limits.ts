import type { SocketLimitErrorMessage } from '@screenify/shared';
import type { ExtendedError } from 'socket.io';
import { env } from '../config/env.js';
import { AttemptLimiter } from '../utils/attempt-limiter.js';
import { clientIp } from '../utils/client-ip.js';
import { logger } from '../utils/logger.js';
import { TokenBucket } from '../utils/token-bucket.js';
import type { AppSocket } from './types.js';

/** Tamanho máximo de uma mensagem do Socket.IO (o padrão é 1 MB) */
export const MAX_MESSAGE_BYTES = 512 * 1024;

export const CONNECTION_LIMITS = {
  /** Conexões abertas ao mesmo tempo por IP */
  openPerIp: env.SOCKET_MAX_CONNECTIONS_PER_IP,
  /** Conexões novas por IP por minuto: barra scripts abrindo e fechando conexões em loop */
  newPerMinute: env.SOCKET_NEW_CONNECTIONS_PER_MINUTE,
} as const;

export const EVENT_LIMITS = {
  /** Rajada permitida: entrar na sala e começar a transmitir disparam vários eventos juntos */
  burst: 120,
  /** Ritmo sustentado: cursor e desenho somam no máximo 40 por segundo num uso normal */
  perSecond: 60,
  /** Descartes acumulados que indicam abuso, e não um pico: a conexão é derrubada */
  dropsBeforeDisconnect: 300,
} as const;

const LIMIT_ERROR: SocketLimitErrorMessage = 'TOO_MANY_CONNECTIONS';

/**
 * Limita conexões por IP. O `check` roda antes da autenticação: quem abre conexões em excesso
 * não chega a fazer o servidor consultar o banco. O `track` roda quando a conexão é aceita
 * e a desconta ao fechar; contar só as aceitas evita que conexões recusadas fiquem somadas.
 */
export function createConnectionGuard() {
  const open = new Map<string, number>();
  const recent = new AttemptLimiter(CONNECTION_LIMITS.newPerMinute, 60_000);
  setInterval(() => recent.prune(), 60_000).unref();

  const ipOf = (socket: AppSocket) =>
    clientIp(socket.handshake.headers['x-forwarded-for'], socket.handshake.address, env.TRUST_PROXY);

  return {
    check(socket: AppSocket, next: (error?: ExtendedError) => void): void {
      const ip = ipOf(socket);
      const current = open.get(ip) ?? 0;

      if (current >= CONNECTION_LIMITS.openPerIp || recent.isBlocked(ip)) {
        logger.warn({ ip, open: current }, '[SOCKET] Connection limit reached');
        next(new Error(LIMIT_ERROR));
        return;
      }
      // O AttemptLimiter conta eventos numa janela de tempo; aqui, tentativas de conexão
      recent.registerFailure(ip);
      next();
    },

    track(socket: AppSocket): void {
      const ip = ipOf(socket);
      open.set(ip, (open.get(ip) ?? 0) + 1);
      socket.once('disconnect', () => {
        const remaining = (open.get(ip) ?? 1) - 1;
        if (remaining <= 0) open.delete(ip);
        else open.set(ip, remaining);
      });
    },
  };
}

/**
 * Limita o ritmo de mensagens de cada conexão, para todos os eventos. O excesso é descartado
 * em silêncio; quem insiste muito além do limite é desconectado.
 */
export function limitEventRate(socket: AppSocket): void {
  const bucket = new TokenBucket(EVENT_LIMITS.burst, EVENT_LIMITS.perSecond);
  let drops = 0;

  socket.use((_packet, next) => {
    if (bucket.take()) {
      next();
      return;
    }

    drops++;
    if (drops === 1) {
      logger.warn({ userId: socket.data.user.id }, '[SOCKET] Event rate limit reached');
    }
    if (drops >= EVENT_LIMITS.dropsBeforeDisconnect) {
      logger.warn({ userId: socket.data.user.id, drops }, '[SOCKET] Disconnected for flooding');
      socket.disconnect(true);
    }
    // Sem chamar next: a mensagem é descartada e não chega a nenhum handler
  });
}