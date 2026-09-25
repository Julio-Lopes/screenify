import { availableParallelism } from 'node:os';
import * as mediasoup from 'mediasoup';
import type { types } from 'mediasoup';
import { logger } from '../utils/logger.js';

export interface WorkerPoolSettings {
  listenIp: string;
  announcedAddress: string | undefined;
  minPort: number;
  maxPort: number;
}

interface WorkerEntry {
  worker: types.Worker;
  webRtcServer: types.WebRtcServer;
}

/**
 * Processos do mediasoup (workers). Cada worker usa um núcleo de CPU e tem um
 * WebRtcServer escutando numa única porta UDP e TCP, compartilhada por todas as conexões.
 */
export class WorkerPool {
  private nextIndex = 0;

  private constructor(private readonly entries: WorkerEntry[]) {}

  static async create(settings: WorkerPoolSettings): Promise<WorkerPool> {
    const portsInRange = settings.maxPort - settings.minPort + 1;
    const count = Math.min(availableParallelism(), portsInRange);
    const entries: WorkerEntry[] = [];

    for (let index = 0; index < count; index++) {
      const port = settings.minPort + index;
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      });

      worker.on('died', (error) => {
        // Sem o worker não existe mídia: melhor reiniciar o processo inteiro (o Docker/Coolify sobe de novo)
        logger.fatal({ err: error, pid: worker.pid }, '[MEDIASOUP] Worker died, exiting');
        setTimeout(() => process.exit(1), 1000);
      });

      const listen = { ip: settings.listenIp, announcedAddress: settings.announcedAddress, port };
      const webRtcServer = await worker.createWebRtcServer({
        listenInfos: [
          { ...listen, protocol: 'udp' },
          { ...listen, protocol: 'tcp' },
        ],
      });

      entries.push({ worker, webRtcServer });
      logger.info({ pid: worker.pid, port }, '[MEDIASOUP] Worker created');
    }

    return new WorkerPool(entries);
  }

  /** Distribui as salas entre os workers em rodízio */
  next(): WorkerEntry {
    const entry = this.entries[this.nextIndex % this.entries.length];
    if (!entry) {
      throw new Error('Nenhum worker do mediasoup disponível');
    }
    this.nextIndex++;
    return entry;
  }

  get size(): number {
    return this.entries.length;
  }

  close(): void {
    for (const { worker } of this.entries) {
      worker.close();
    }
  }
}