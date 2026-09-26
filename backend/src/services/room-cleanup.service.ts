import { roomAnnotations } from '../annotations/room-annotations.js';
import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { roomPresence } from '../websocket/room-presence.js';

/** O que a limpeza precisa da mídia: fechar o Router de uma sala, se ainda existir */
interface MediaCloser {
  close(roomId: string): Promise<void>;
}

/** Salas verificadas por rodada: uma rodada nunca segura o banco por muito tempo */
const BATCH_SIZE = 100;

/**
 * Exclui salas que ficaram vazias por tempo demais.
 *
 * Em vez de um cronômetro por sala, o relógio fica no banco: o `emptySince` é gravado quando
 * o último participante sai e apagado quando alguém entra (isso é o "cancelar o timer").
 * Uma verificação periódica apaga o que venceu. Assim a contagem sobrevive a reinícios
 * e deploys: uma sala que ficou vazia antes de um deploy expira no horário certo depois dele.
 */
export class RoomCleanupService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly emptyTimeoutMs: number,
    private readonly media: MediaCloser,
  ) {}

  /** Verifica a cada décimo do prazo (entre 5 e 30 segundos): a sala expira no máximo isso depois */
  get intervalMs(): number {
    return Math.min(30_000, Math.max(5_000, this.emptyTimeoutMs / 10));
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runOnce().catch((error: unknown) => logger.error({ err: error }, '[ROOM] Cleanup failed'));
    }, this.intervalMs);
    // Não impede o processo de encerrar
    this.timer.unref();
    logger.info({ timeoutSeconds: this.emptyTimeoutMs / 1000 }, '[ROOM] Cleanup scheduled');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Uma rodada de limpeza; devolve os códigos das salas excluídas */
  async runOnce(now = new Date()): Promise<string[]> {
    const cutoff = new Date(now.getTime() - this.emptyTimeoutMs);
    const candidates = await prisma.room.findMany({
      where: { emptySince: { lte: cutoff } },
      select: { id: true, code: true },
      take: BATCH_SIZE,
    });

    const expired: string[] = [];
    for (const room of candidates) {
      // Garantia extra: se há alguém conectado agora, a sala não está vazia, diga o banco o que disser
      if (roomPresence.size(room.id) > 0) continue;

      // A condição repetida no DELETE fecha a corrida: se alguém entrou entre a consulta e agora,
      // o emptySince virou null e nada é apagado
      const { count } = await prisma.room.deleteMany({
        where: { id: room.id, emptySince: { lte: cutoff } },
      });
      if (count === 0) continue;

      // Participantes saem junto (cascade); o estado em memória é limpo aqui
      await this.media.close(room.id);
      roomAnnotations.deleteRoom(room.id);

      logger.info({ code: room.code }, '[ROOM] Expired');
      expired.push(room.code);
    }

    return expired;
  }
}