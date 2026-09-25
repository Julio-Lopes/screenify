import { logger } from '../utils/logger.js';
import { MEDIA_CODECS } from './media-config.js';
import { RoomMedia, type RoomMediaEvents } from './room-media.js';
import type { WorkerPool } from './worker-pool.js';

/** Um RoomMedia por sala, criado só quando alguém usa mídia pela primeira vez */
export class MediaRegistry {
  private readonly rooms = new Map<string, Promise<RoomMedia>>();

  constructor(private readonly workers: WorkerPool) {}

  get(roomId: string): Promise<RoomMedia> | undefined {
    return this.rooms.get(roomId);
  }

  getOrCreate(roomId: string, events: RoomMediaEvents): Promise<RoomMedia> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    // Guarda a Promise, não o resultado: dois pedidos simultâneos recebem o mesmo Router
    const creation = (async () => {
      const { worker, webRtcServer } = this.workers.next();
      const router = await worker.createRouter({ mediaCodecs: MEDIA_CODECS });
      logger.info({ roomId, workerPid: worker.pid }, '[MEDIASOUP] Router created');
      return new RoomMedia(roomId, router, webRtcServer, events);
    })();

    this.rooms.set(roomId, creation);
    creation.catch(() => this.rooms.delete(roomId));
    return creation;
  }

  async close(roomId: string): Promise<void> {
    const media = this.rooms.get(roomId);
    if (!media) return;
    this.rooms.delete(roomId);
    (await media).close();
  }
}