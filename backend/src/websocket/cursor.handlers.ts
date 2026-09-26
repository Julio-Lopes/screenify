import { z } from 'zod';
import { roomChannel, type AppSocket } from './types.js';

const cursorSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

/** O cliente manda no máximo 20 posições por segundo; o servidor aceita até ~30 e descarta o excesso */
const MIN_INTERVAL_MS = 30;

/**
 * Cursores colaborativos. Nada é guardado: é só repassado para a sala. As mensagens são
 * "voláteis": se a conexão de alguém estiver congestionada, posições antigas são descartadas
 * em vez de enfileiradas, porque só a mais recente importa.
 */
export function registerCursorHandlers(socket: AppSocket): void {
  const userId = socket.data.user.id;
  let lastMove = 0;

  socket.on('cursor:move', (payload) => {
    const roomId = socket.data.roomId;
    const now = Date.now();
    if (!roomId || now - lastMove < MIN_INTERVAL_MS) return;

    const parsed = cursorSchema.safeParse(payload);
    if (!parsed.success) return;

    lastMove = now;
    socket.to(roomChannel(roomId)).volatile.emit('cursor:moved', { userId, ...parsed.data });
  });

  socket.on('cursor:leave', () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomChannel(roomId)).emit('cursor:left', { userId });
  });
}