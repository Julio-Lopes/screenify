import { roomAnnotations } from '../annotations/room-annotations.js';
import { appendStrokeSchema, endStrokeSchema, startStrokeSchema } from '../schemas/drawing.schemas.js';
import { logger } from '../utils/logger.js';
import { roomChannel, type AppSocket } from './types.js';

/**
 * Sincronização dos desenhos. Mensagens inválidas são descartadas em silêncio: responder
 * cada uma dobraria o tráfego de um fluxo que chega várias vezes por segundo.
 */
export function registerDrawingHandlers(socket: AppSocket): void {
  const userId = socket.data.user.id;

  socket.on('drawing:start', (payload) => {
    const roomId = socket.data.roomId;
    const parsed = startStrokeSchema.safeParse(payload);
    if (!roomId || !parsed.success) {
      logger.debug({ userId }, '[DRAWING] Invalid start ignored');
      return;
    }

    const stroke = roomAnnotations.start(roomId, userId, parsed.data);
    if (stroke) {
      socket.to(roomChannel(roomId)).emit('drawing:started', stroke);
    }
  });

  socket.on('drawing:append', (payload) => {
    const roomId = socket.data.roomId;
    const parsed = appendStrokeSchema.safeParse(payload);
    if (!roomId || !parsed.success) return;

    if (roomAnnotations.append(roomId, userId, parsed.data.id, parsed.data.points)) {
      socket.to(roomChannel(roomId)).emit('drawing:appended', parsed.data);
    }
  });

  socket.on('drawing:end', (payload) => {
    const roomId = socket.data.roomId;
    const parsed = endStrokeSchema.safeParse(payload);
    if (!roomId || !parsed.success) return;

    if (roomAnnotations.end(roomId, userId, parsed.data.id)) {
      socket.to(roomChannel(roomId)).emit('drawing:ended', { id: parsed.data.id });
    }
  });

  socket.on('drawing:sync', (ack) => {
    if (typeof ack !== 'function') return;
    const roomId = socket.data.roomId;
    ack(roomId ? roomAnnotations.snapshot(roomId) : { strokes: [], active: [] });
  });
}