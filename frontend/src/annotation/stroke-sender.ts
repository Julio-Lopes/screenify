import type { Point, Stroke } from '@screenify/shared';
import type { AppSocket } from '../services/socket';

/** Intervalo entre envios de pontos: no máximo 20 mensagens por segundo por traço */
export const FLUSH_INTERVAL_MS = 50;
/** O servidor recusa mensagens acima de 512 KB; lotes grandes (desfazer um "limpar") são divididos */
const MAX_BATCH_BYTES = 200 * 1024;
/** Limite de ids por mensagem aceito pelo servidor */
const MAX_IDS_PER_MESSAGE = 500;

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

  /**
   * Acrescenta pontos ao próximo lote. Em formas (linha, seta, retângulo, círculo) só importa
   * onde o arraste está agora: "latest" guarda apenas o último ponto, e o lote leva um só.
   */
  add(id: string, points: Point[], mode: 'append' | 'latest' = 'append'): void {
    const last = points.at(-1);
    if (!last) return;
    this.pending.set(id, mode === 'latest' ? [last] : [...(this.pending.get(id) ?? []), ...points]);
    this.timer ??= setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  remove(ids: string[]): void {
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_MESSAGE) {
      this.socket.emit('drawing:remove', { ids: ids.slice(i, i + MAX_IDS_PER_MESSAGE) });
    }
  }

  /** Divide em mensagens de até ~200 KB: desfazer a limpeza de uma tela cheia pode somar megabytes */
  restore(strokes: Stroke[]): void {
    let batch: Stroke[] = [];
    let batchBytes = 0;

    for (const stroke of strokes) {
      const bytes = JSON.stringify(stroke).length;
      if (batch.length > 0 && batchBytes + bytes > MAX_BATCH_BYTES) {
        this.socket.emit('drawing:restore', { strokes: batch });
        batch = [];
        batchBytes = 0;
      }
      batch.push(stroke);
      batchBytes += bytes;
    }
    if (batch.length > 0) this.socket.emit('drawing:restore', { strokes: batch });
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