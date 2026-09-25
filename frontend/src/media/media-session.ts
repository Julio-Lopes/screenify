import { Device, type types } from 'mediasoup-client';
import type { MediaSignaling } from './media-signaling';

/**
 * A parte de mídia de uma pessoa conectada à sala: o Device (o que o navegador sabe
 * codificar e decodificar) e o transport de envio. Vive enquanto a conexão com a sala existir.
 */
export class MediaSession {
  private readonly signaling: MediaSignaling;
  private devicePromise: Promise<Device> | null = null;
  private sendTransportPromise: Promise<types.Transport> | null = null;
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
    this.sendTransportPromise ??= this.createSendTransport();
    this.sendTransportPromise.catch(() => {
      this.sendTransportPromise = null;
    });
    return this.sendTransportPromise;
  }

  close(): void {
    this.closed = true;
    void this.sendTransportPromise?.then((transport) => transport.close()).catch(() => undefined);
    this.sendTransportPromise = null;
  }

  private async createSendTransport(): Promise<types.Transport> {
    const device = await this.getDevice();
    if (!device.canProduce('video')) {
      throw new Error('Seu navegador não consegue enviar vídeo para esta sala.');
    }

    const info = await this.signaling.createTransport('send');
    const transport = device.createSendTransport(info);

    // Primeira transmissão: o navegador entrega as chaves DTLS para o servidor
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.signaling
        .connectTransport({ transportId: transport.id, dtlsParameters })
        .then(callback)
        .catch((error: unknown) => errback(error instanceof Error ? error : new Error(String(error))));
    });

    // Cada transport.produce() do navegador vira um Producer no servidor
    transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
      this.signaling
        .produce({ transportId: transport.id, kind, rtpParameters, source: 'screen' })
        .then(({ producerId }) => callback({ id: producerId }))
        .catch((error: unknown) => errback(error instanceof Error ? error : new Error(String(error))));
    });

    // Se a sessão foi encerrada enquanto o transport era criado, ele não deve sobreviver
    if (this.closed) {
      transport.close();
      throw new Error('Sessão de mídia encerrada');
    }
    return transport;
  }
}