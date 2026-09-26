import type { TransportDirection } from '@screenify/shared';
import { Device, type types } from 'mediasoup-client';
import type { MediaSignaling } from './media-signaling';

/**
 * A parte de mídia de uma pessoa conectada à sala: o Device (o que o navegador sabe
 * codificar e decodificar) e os transports de envio e de recebimento.
 * Vive enquanto a conexão com a sala existir.
 */
export class MediaSession {
  private readonly signaling: MediaSignaling;
  private devicePromise: Promise<Device> | null = null;
  private readonly transports = new Map<TransportDirection, Promise<types.Transport>>();
  private closed = false;

  constructor(signaling: MediaSignaling) {
    this.signaling = signaling;
  }

  /** Carrega o Device com os codecs do Router da sala (uma vez só) */
  getDevice(): Promise<Device> {
    this.devicePromise ??= (async () => {
      const device = await Device.factory();
      await device.load({ routerRtpCapabilities: await this.signaling.getRtpCapabilities() });
      return device;
    })();
    this.devicePromise.catch(() => {
      this.devicePromise = null;
    });
    return this.devicePromise;
  }

  /** Transport de envio, criado na primeira transmissão e reaproveitado nas seguintes */
  getSendTransport(): Promise<types.Transport> {
    return this.getTransport('send');
  }

  /** Transport de recebimento, criado na primeira vez que a pessoa assiste a algo */
  getRecvTransport(): Promise<types.Transport> {
    return this.getTransport('recv');
  }

  /** Descarta o transport de recebimento (depois de uma falha): o próximo pedido cria outro */
  resetRecvTransport(): void {
    const current = this.transports.get('recv');
    this.transports.delete('recv');
    void current?.then((transport) => transport.close()).catch(() => undefined);
  }

  /**
   * Assiste a uma transmissão: o servidor cria o Consumer pausado, o navegador monta o
   * receptor e só então o servidor libera o vídeo, para nenhum quadro chegar antes da hora.
   */
  async consume(producerId: string): Promise<{ consumer: types.Consumer; simulcast: boolean }> {
    const device = await this.getDevice();
    const transport = await this.getRecvTransport();

    const info = await this.signaling.consume({ producerId, rtpCapabilities: device.recvRtpCapabilities });
    const consumer = await transport.consume({
      id: info.id,
      producerId: info.producerId,
      kind: info.kind,
      rtpParameters: info.rtpParameters,
    });

    try {
      await this.signaling.resumeConsumer(consumer.id);
    } catch (error) {
      consumer.close();
      throw error;
    }
    return { consumer, simulcast: info.simulcast };
  }

  close(): void {
    this.closed = true;
    for (const promise of this.transports.values()) {
      void promise.then((transport) => transport.close()).catch(() => undefined);
    }
    this.transports.clear();
  }

  private getTransport(direction: TransportDirection): Promise<types.Transport> {
    let promise = this.transports.get(direction);
    if (!promise) {
      promise = this.createTransport(direction);
      this.transports.set(direction, promise);
      promise.catch(() => {
        if (this.transports.get(direction) === promise) this.transports.delete(direction);
      });
    }
    return promise;
  }

  private async createTransport(direction: TransportDirection): Promise<types.Transport> {
    const device = await this.getDevice();
    if (direction === 'send' && !device.canProduce('video')) {
      throw new Error('Seu navegador não consegue enviar vídeo para esta sala.');
    }

    const info = await this.signaling.createTransport(direction);
    const transport = direction === 'send' ? device.createSendTransport(info) : device.createRecvTransport(info);

    // Primeiro uso do transport: o navegador entrega as chaves DTLS para o servidor
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.signaling
        .connectTransport({ transportId: transport.id, dtlsParameters })
        .then(callback)
        .catch((error: unknown) => errback(toError(error)));
    });

    if (direction === 'send') {
      // Cada transport.produce() do navegador vira um Producer no servidor
      transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        this.signaling
          .produce({ transportId: transport.id, kind, rtpParameters, source: 'screen' })
          .then(({ producerId }) => callback({ id: producerId }))
          .catch((error: unknown) => errback(toError(error)));
      });
    }

    // Se a sessão foi encerrada enquanto o transport era criado, ele não deve sobreviver
    if (this.closed) {
      transport.close();
      throw new Error('Sessão de mídia encerrada');
    }
    return transport;
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}