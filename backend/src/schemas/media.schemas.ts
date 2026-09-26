import { z } from 'zod';

// Os ids do mediasoup são UUIDs
const mediasoupId = z.uuid();

/*
 * Estes schemas conferem a estrutura básica e barram lixo antes de chegar ao mediasoup.
 * A validação profunda dos parâmetros RTP e DTLS é feita pelo próprio mediasoup,
 * que lança TypeError quando algo não bate.
 */

export const createTransportSchema = z.object({
  direction: z.enum(['send', 'recv']),
});

export const connectTransportSchema = z.object({
  transportId: mediasoupId,
  dtlsParameters: z.looseObject({
    fingerprints: z.array(z.looseObject({ algorithm: z.string(), value: z.string() })).min(1),
  }),
});

export const produceSchema = z.object({
  transportId: mediasoupId,
  kind: z.enum(['audio', 'video']),
  rtpParameters: z.looseObject({
    codecs: z.array(z.looseObject({ mimeType: z.string() })).min(1),
  }),
  source: z.literal('screen'),
});

export const producerIdSchema = z.object({
  producerId: mediasoupId,
});

export const consumeSchema = z.object({
  producerId: mediasoupId,
  rtpCapabilities: z.looseObject({
    codecs: z.array(z.looseObject({ mimeType: z.string() })).min(1),
  }),
});

export const consumerIdSchema = z.object({
  consumerId: mediasoupId,
});

export const setPreferredLayersSchema = z.object({
  consumerId: mediasoupId,
  spatialLayer: z.int().min(0).max(2),
});