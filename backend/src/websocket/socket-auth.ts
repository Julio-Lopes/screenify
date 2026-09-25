import type { SocketAuthErrorMessage } from '@screenify/shared';
import type { ExtendedError } from 'socket.io';
import { findUserBySessionToken } from '../services/user.service.js';
import { logger } from '../utils/logger.js';
import type { AppSocket } from './types.js';

const AUTH_ERROR: SocketAuthErrorMessage = 'UNAUTHORIZED';

/** Roda uma vez por conexão, antes de qualquer evento: sem sessão válida, não conecta */
export async function socketAuth(socket: AppSocket, next: (error?: ExtendedError) => void): Promise<void> {
  const token: unknown = socket.handshake.auth.token;

  if (typeof token !== 'string' || token.length === 0) {
    next(new Error(AUTH_ERROR));
    return;
  }

  try {
    const user = await findUserBySessionToken(token);
    if (!user) {
      next(new Error(AUTH_ERROR));
      return;
    }

    socket.data.user = user;
    socket.data.roomId = null;
    next();
  } catch (error) {
    logger.error({ err: error }, '[SOCKET] Auth failed');
    next(new Error('INTERNAL_ERROR'));
  }
}