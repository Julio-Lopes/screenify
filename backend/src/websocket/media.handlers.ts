import type {
  ConnectTransportPayload,
  ConsumePayload,
  MediaResult,
  ProducePayload,
} from '@screenify/shared';
import { errors as mediasoupErrors } from 'mediasoup';
import type { z } from 'zod';
import { MediaError } from '../mediasoup/media-error.js';
import type { MediaRegistry } from '../mediasoup/media-registry.js';
import type { RoomMedia } from '../mediasoup/room-media.js';
import {
  connectTransportSchema,
  consumeSchema,
  consumerIdSchema,
  createTransportSchema,
  produceSchema,
  producerIdSchema,
  setPreferredLayersSchema,
  updateProducerQualitySchema,
} from '../schemas/media.schemas.js';
import { logger } from '../utils/logger.js';
import { roomChannel, type AppServer, type AppSocket } from './types.js';

type Ack<T> = (result: MediaResult<T>) => void;

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new MediaError('INVALID_PAYLOAD', 'Dados de mídia inválidos');
  }
  return result.data;
}

/** Executa a ação e responde o ack com sucesso ou com um erro que o cliente entende */
async function respond<T>(socket: AppSocket, event: string, reply: Ack<T>, action: () => Promise<T>): Promise<void> {
  // O tipo diz que é função, mas quem manda o evento é o cliente: pode não ter enviado o ack
  if (typeof reply !== 'function') return;

  try {
    reply({ ok: true, data: await action() });
  } catch (error) {
    if (error instanceof MediaError) {
      reply({ ok: false, error: error.code, message: error.message });
      return;
    }
    // O mediasoup lança TypeError quando os parâmetros RTP/DTLS não fazem sentido
    if (error instanceof TypeError || error instanceof mediasoupErrors.UnsupportedError) {
      reply({ ok: false, error: 'INVALID_PAYLOAD', message: 'Parâmetros de mídia inválidos' });
      return;
    }
    logger.error({ err: error, event, userId: socket.data.user.id }, '[MEDIASOUP] Request failed');
    reply({ ok: false, error: 'INTERNAL_ERROR', message: 'Erro interno de mídia' });
  }
}

export function registerMediaHandlers(io: AppServer, socket: AppSocket, media: MediaRegistry): void {
  const userId = socket.data.user.id;

  async function roomMedia(): Promise<RoomMedia> {
    const roomId = socket.data.roomId;
    if (!roomId) {
      throw new MediaError('NOT_IN_ROOM', 'Entre na sala antes de usar mídia');
    }
    return media.getOrCreate(roomId, {
      onProducerClosed: (producerId) => io.to(roomChannel(roomId)).emit('media:producer-closed', { producerId }),
    });
  }

  socket.on('media:get-rtp-capabilities', (ack) =>
    respond(socket, 'get-rtp-capabilities', ack, async () => (await roomMedia()).rtpCapabilities),
  );

  socket.on('media:create-transport', (payload, ack) =>
    respond(socket, 'create-transport', ack, async () => {
      const { direction } = parse(createTransportSchema, payload);
      return (await roomMedia()).createTransport(userId, direction);
    }),
  );

  socket.on('media:connect-transport', (payload: ConnectTransportPayload, ack) =>
    respond(socket, 'connect-transport', ack, async () => {
      const { transportId } = parse(connectTransportSchema, payload);
      await (await roomMedia()).connectTransport(userId, transportId, payload.dtlsParameters);
      return null;
    }),
  );

  socket.on('media:produce', (payload: ProducePayload, ack) =>
    respond(socket, 'produce', ack, async () => {
      const { transportId, kind, source, quality, target } = parse(produceSchema, payload);
      const producer = await (await roomMedia()).produce(
        userId,
        transportId,
        kind,
        payload.rtpParameters,
        source,
        quality ?? null,
        target ?? null,
      );

      if (socket.data.roomId) {
        socket.to(roomChannel(socket.data.roomId)).emit('media:producer-added', producer);
      }
      return { producerId: producer.producerId };
    }),
  );

  socket.on('media:close-producer', (payload, ack) =>
    respond(socket, 'close-producer', ack, async () => {
      const { producerId } = parse(producerIdSchema, payload);
      (await roomMedia()).closeProducer(userId, producerId);
      return null;
    }),
  );

  socket.on('media:list-producers', (ack) =>
    respond(socket, 'list-producers', ack, async () => (await roomMedia()).listProducers()),
  );

  socket.on('media:consume', (payload: ConsumePayload, ack) =>
    respond(socket, 'consume', ack, async () => {
      const { producerId } = parse(consumeSchema, payload);
      return (await roomMedia()).consume(userId, producerId, payload.rtpCapabilities);
    }),
  );

  socket.on('media:resume-consumer', (payload, ack) =>
    respond(socket, 'resume-consumer', ack, async () => {
      const { consumerId } = parse(consumerIdSchema, payload);
      await (await roomMedia()).resumeConsumer(userId, consumerId);
      return null;
    }),
  );

  socket.on('media:set-preferred-layers', (payload, ack) =>
    respond(socket, 'set-preferred-layers', ack, async () => {
      const { consumerId, spatialLayer } = parse(setPreferredLayersSchema, payload);
      await (await roomMedia()).setPreferredLayers(userId, consumerId, spatialLayer);
      return null;
    }),
  );

  socket.on('media:update-producer-quality', (payload, ack) =>
    respond(socket, 'update-producer-quality', ack, async () => {
      const { producerId, quality, target } = parse(updateProducerQualitySchema, payload);
      (await roomMedia()).updateProducerQuality(userId, producerId, quality, target);

      if (socket.data.roomId) {
        socket.to(roomChannel(socket.data.roomId)).emit('media:producer-quality', { producerId, quality, target });
      }
      return null;
    }),
  );
}