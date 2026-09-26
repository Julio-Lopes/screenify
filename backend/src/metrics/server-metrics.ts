import type { ServerMetrics } from '@screenify/shared';
import type { MediaRegistry } from '../mediasoup/media-registry.js';
import type { WorkerPool } from '../mediasoup/worker-pool.js';
import { roomPresence } from '../websocket/room-presence.js';

/** Monta a fotografia do servidor: salas, mídia, workers do mediasoup e o próprio processo */
export function createMetricsCollector(media: MediaRegistry, workers: WorkerPool): () => Promise<ServerMetrics> {
  return async () => ({
    uptimeSeconds: Math.round(process.uptime()),
    rooms: roomPresence.stats(),
    media: await media.stats(),
    workers: await workers.usage(),
    process: { memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024) },
  });
}