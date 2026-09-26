import type { Point, Stroke } from '@screenify/shared';
import type { AppSocket } from '../services/socket';

/** Intervalo entre envios de pontos: no máximo 20 mensagens por segundo por traço */
export const FLUSH_INTERVAL_MS = 50;

/**
 * Envia os traços para a sala enquanto são desenhados. Os pontos são acumulados e enviados
 * em lotes a cada 50 ms, em vez de uma mensagem por movimento do mouse: o desenho chega fluido
 * para quem assiste e o servidor recebe dezenas de mensagens por segundo, não milhares.
 */
export class StrokeSender {
  private readonly socket: AppSocket;
  private readonly pending = new Map<string, Point[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(socket: AppSocket) {
    this.socket = socket;
  }

  start(stroke: Stroke): void {
    const { userId: _userId, ...payload } = stroke;
    this.socket.emit('drawing:start', payload);
  }

  add(id: string, points: Point[]): void {
    if (points.length === 0) return;
    this.pending.set(id, [...(this.pending.get(id) ?? []), ...points]);
    this.timer ??= setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  end(id: string): void {
    // O que ainda estava no lote sai antes do fim, para o traço chegar inteiro
    this.flush();
    this.socket.emit('drawing:end', { id });
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const [id, points] of this.pending) {
      this.socket.emit('drawing:append', { id, points });
    }
    this.pending.clear();
  }

  dispose(): void {
    this.flush();
  }
}