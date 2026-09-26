import type {
  ConsumerInfo,
  DtlsParameters,
  MediaKind,
  MediaSource,
  ProducerInfo,
  QualityTarget,
  RtpCapabilities,
  RtpParameters,
  TransportDirection,
  TransportInfo,
  VideoQuality,
} from '@screenify/shared';
import type { types } from 'mediasoup';
import { logger } from '../utils/logger.js';
import { INITIAL_OUTGOING_BITRATE, MAX_INCOMING_BITRATE } from './media-config.js';
import { MediaError } from './media-error.js';

/*
 * Os tipos do mediasoup (servidor) listam mais extensões RTP que os do mediasoup-client,
 * mas o formato em tempo de execução é o mesmo: é o protocolo oficial entre os dois.
 * As conversões ficam concentradas aqui, nos únicos pontos em que dados do servidor viram contrato.
 */
function toClientCapabilities(capabilities: types.RtpCapabilities): RtpCapabilities {
  return capabilities as RtpCapabilities;
}

function toClientParameters(parameters: types.RtpParameters): RtpParameters {
  return parameters as RtpParameters;
}

interface ProducerAppData extends types.AppData {
  userId: string;
  source: MediaSource;
  quality: VideoQuality | null;
  target: QualityTarget | null;
}

/** Tudo de mídia que pertence a uma pessoa na sala */
interface PeerMedia {
  transports: Map<string, types.WebRtcTransport>;
  producers: Map<string, types.Producer<ProducerAppData>>;
  consumers: Map<string, types.Consumer>;
}

export interface RoomMediaEvents {
  onProducerClosed: (producerId: string) => void;
}

/**
 * Mídia de uma sala: um Router (o "ambiente de mídia") e, para cada pessoa,
 * seus transports, producers e consumers.
 */
export class RoomMedia {
  private readonly peers = new Map<string, PeerMedia>();
  private closed = false;

  constructor(
    readonly roomId: string,
    private readonly router: types.Router,
    private readonly webRtcServer: types.WebRtcServer,
    private readonly events: RoomMediaEvents,
  ) {}

  get rtpCapabilities(): RtpCapabilities {
    return toClientCapabilities(this.router.rtpCapabilities);
  }

  async createTransport(userId: string, direction: TransportDirection): Promise<TransportInfo> {
    const peer = this.getOrCreatePeer(userId);

    // Cada pessoa tem no máximo um transport por direção: pedir outro substitui o anterior
    for (const transport of peer.transports.values()) {
      if (transport.appData.direction === direction) {
        transport.close();
        peer.transports.delete(transport.id);
      }
    }

    const transport = await this.router.createWebRtcTransport({
      webRtcServer: this.webRtcServer,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: INITIAL_OUTGOING_BITRATE,
      appData: { userId, direction },
    });

    if (direction === 'send') {
      await transport.setMaxIncomingBitrate(MAX_INCOMING_BITRATE);
    }

    transport.on('dtlsstatechange', (state) => {
      if (state === 'failed' || state === 'closed') {
        logger.warn({ roomId: this.roomId, userId, direction, state }, '[MEDIASOUP] Transport DTLS state');
      }
    });

    peer.transports.set(transport.id, transport);
    logger.info({ roomId: this.roomId, userId, direction }, '[MEDIASOUP] Transport created');

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(userId: string, transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    const transport = this.getTransport(userId, transportId);
    await transport.connect({ dtlsParameters });
  }

  async produce(
    userId: string,
    transportId: string,
    kind: MediaKind,
    rtpParameters: RtpParameters,
    source: MediaSource,
    quality: VideoQuality | null,
    target: QualityTarget | null,
  ): Promise<ProducerInfo> {
    const transport = this.getTransport(userId, transportId);

    if (transport.appData.direction !== 'send') {
      throw new MediaError('TRANSPORT_NOT_FOUND', 'Este transport não é de envio');
    }

    // Uma tela por sala: o design system desabilita o botão enquanto outra pessoa transmite
    if (source === 'screen' && kind === 'video' && this.findScreenProducer()) {
      throw new MediaError('SCREEN_ALREADY_SHARED', 'Outra pessoa já está compartilhando a tela');
    }

    const producer = await transport.produce<ProducerAppData>({
      kind,
      rtpParameters,
      appData: { userId, source, quality, target },
    });

    const peer = this.getOrCreatePeer(userId);
    peer.producers.set(producer.id, producer);

    // O transport pode fechar sozinho (saída da sala, troca de transport): o producer vai junto
    producer.observer.on('close', () => {
      peer.producers.delete(producer.id);
      if (!this.closed) {
        this.events.onProducerClosed(producer.id);
      }
      logger.info({ roomId: this.roomId, userId, producerId: producer.id }, '[MEDIASOUP] Producer closed');
    });

    // O score sobe acima de zero quando os pacotes de vídeo começam a chegar de fato
    let receiving = false;
    producer.on('score', (scores) => {
      const hasMedia = scores.some((entry) => entry.score > 0);
      if (hasMedia !== receiving) {
        receiving = hasMedia;
        logger.info(
          { roomId: this.roomId, userId, producerId: producer.id },
          hasMedia ? '[MEDIASOUP] Producer receiving media' : '[MEDIASOUP] Producer stopped receiving media',
        );
      }
    });

    logger.info(
      { roomId: this.roomId, userId, kind, source, layers: rtpParameters.encodings?.length ?? 1 },
      '[MEDIASOUP] Producer created',
    );
    return this.toProducerInfo(producer);
  }

  updateProducerQuality(userId: string, producerId: string, quality: VideoQuality, target: QualityTarget): void {
    const producer = this.peers.get(userId)?.producers.get(producerId);
    if (!producer) {
      throw new MediaError('PRODUCER_NOT_FOUND', 'Transmissão não encontrada');
    }
    producer.appData.quality = quality;
    producer.appData.target = target;
  }

  closeProducer(userId: string, producerId: string): void {
    const producer = this.peers.get(userId)?.producers.get(producerId);
    if (!producer) {
      throw new MediaError('PRODUCER_NOT_FOUND', 'Transmissão não encontrada');
    }
    producer.close();
  }

  listProducers(): ProducerInfo[] {
    return [...this.peers.values()].flatMap((peer) => [...peer.producers.values()].map((p) => this.toProducerInfo(p)));
  }

  async consume(userId: string, producerId: string, rtpCapabilities: RtpCapabilities): Promise<ConsumerInfo> {
    const peer = this.getOrCreatePeer(userId);
    const transport = [...peer.transports.values()].find((t) => t.appData.direction === 'recv');

    if (!transport) {
      throw new MediaError('TRANSPORT_NOT_FOUND', 'Crie um transport de recebimento antes de assistir');
    }
    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new MediaError('CANNOT_CONSUME', 'Seu navegador não suporta o formato desta transmissão');
    }

    // Começa pausado: o navegador só pede para liberar quando já está pronto para exibir
    const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
    peer.consumers.set(consumer.id, consumer);
    consumer.observer.on('close', () => peer.consumers.delete(consumer.id));

    logger.info({ roomId: this.roomId, userId, producerId }, '[MEDIASOUP] Consumer created');

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: toClientParameters(consumer.rtpParameters),
      simulcast: consumer.type === 'simulcast',
    };
  }

  async resumeConsumer(userId: string, consumerId: string): Promise<void> {
    const consumer = this.peers.get(userId)?.consumers.get(consumerId);
    if (!consumer) {
      throw new MediaError('CONSUMER_NOT_FOUND', 'Recebimento não encontrado');
    }
    await consumer.resume();
  }

  /**
   * Define a camada máxima que o espectador quer receber. Abaixo desse teto, o mediasoup continua
   * escolhendo sozinho a melhor camada que a conexão dele aguenta.
   */
  async setPreferredLayers(userId: string, consumerId: string, spatialLayer: number): Promise<void> {
    const consumer = this.peers.get(userId)?.consumers.get(consumerId);
    if (!consumer) {
      throw new MediaError('CONSUMER_NOT_FOUND', 'Recebimento não encontrado');
    }
    if (consumer.type !== 'simulcast') {
      throw new MediaError('INVALID_PAYLOAD', 'Esta transmissão tem uma única qualidade');
    }
    await consumer.setPreferredLayers({ spatialLayer });
  }

  /** Fecha tudo de uma pessoa (saiu da sala ou abriu em outra aba) */
  removePeer(userId: string): void {
    const peer = this.peers.get(userId);
    if (!peer) return;

    // Fechar o transport fecha em cascata os producers e consumers dele
    for (const transport of peer.transports.values()) {
      transport.close();
    }
    this.peers.delete(userId);
  }

  /** Quantos objetos de mídia a sala tem agora, para as métricas do servidor */
  stats(): { transports: number; producers: number; consumers: number } {
    let transports = 0;
    let producers = 0;
    let consumers = 0;
    for (const peer of this.peers.values()) {
      transports += peer.transports.size;
      producers += peer.producers.size;
      consumers += peer.consumers.size;
    }
    return { transports, producers, consumers };
  }

  get isEmpty(): boolean {
    return this.peers.size === 0;
  }

  close(): void {
    this.closed = true;
    this.router.close();
    this.peers.clear();
    logger.info({ roomId: this.roomId }, '[MEDIASOUP] Router closed');
  }

  private getOrCreatePeer(userId: string): PeerMedia {
    let peer = this.peers.get(userId);
    if (!peer) {
      peer = { transports: new Map(), producers: new Map(), consumers: new Map() };
      this.peers.set(userId, peer);
    }
    return peer;
  }

  private getTransport(userId: string, transportId: string): types.WebRtcTransport {
    const transport = this.peers.get(userId)?.transports.get(transportId);
    if (!transport) {
      throw new MediaError('TRANSPORT_NOT_FOUND', 'Conexão de mídia não encontrada');
    }
    return transport;
  }

  private findScreenProducer(): types.Producer<ProducerAppData> | undefined {
    for (const peer of this.peers.values()) {
      for (const producer of peer.producers.values()) {
        if (producer.appData.source === 'screen' && producer.kind === 'video') return producer;
      }
    }
    return undefined;
  }

  private toProducerInfo(producer: types.Producer<ProducerAppData>): ProducerInfo {
    return {
      producerId: producer.id,
      userId: producer.appData.userId,
      kind: producer.kind,
      source: producer.appData.source,
      quality: producer.appData.quality,
      target: producer.appData.target,
    };
  }
}