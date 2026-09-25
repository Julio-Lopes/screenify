import type {
  ConnectTransportPayload,
  MediaErrorCode,
  MediaResult,
  ProducePayload,
  ProducerInfo,
  RtpCapabilities,
  TransportDirection,
  TransportInfo,
} from '@screenify/shared';
import type { AppSocket } from '../services/socket';

const REQUEST_TIMEOUT_MS = 10_000;

export type ClientMediaErrorCode = MediaErrorCode | 'TIMEOUT';

export class MediaRequestError extends Error {
  readonly code: ClientMediaErrorCode;

  constructor(code: ClientMediaErrorCode, message: string) {
    super(message);
    this.name = 'MediaRequestError';
    this.code = code;
  }
}

function unwrap<T>(result: MediaResult<T>): T {
  if (!result.ok) {
    throw new MediaRequestError(result.error, result.message);
  }
  return result.data;
}

/** Os pedidos de mídia ao servidor, em forma de Promise: sucesso devolve os dados, erro vira exceção */
export class MediaSignaling {
  private readonly socket: AppSocket;

  constructor(socket: AppSocket) {
    this.socket = socket;
  }

  getRtpCapabilities(): Promise<RtpCapabilities> {
    return this.request(() => this.withTimeout().emitWithAck('media:get-rtp-capabilities'));
  }

  createTransport(direction: TransportDirection): Promise<TransportInfo> {
    return this.request(() => this.withTimeout().emitWithAck('media:create-transport', { direction }));
  }

  async connectTransport(payload: ConnectTransportPayload): Promise<void> {
    await this.request(() => this.withTimeout().emitWithAck('media:connect-transport', payload));
  }

  produce(payload: ProducePayload): Promise<{ producerId: string }> {
    return this.request(() => this.withTimeout().emitWithAck('media:produce', payload));
  }

  async closeProducer(producerId: string): Promise<void> {
    await this.request(() => this.withTimeout().emitWithAck('media:close-producer', { producerId }));
  }

  listProducers(): Promise<ProducerInfo[]> {
    return this.request(() => this.withTimeout().emitWithAck('media:list-producers'));
  }

  private withTimeout() {
    return this.socket.timeout(REQUEST_TIMEOUT_MS);
  }

  private async request<T>(send: () => Promise<MediaResult<T>>): Promise<T> {
    let result: MediaResult<T>;
    try {
      result = await send();
    } catch {
      // O Socket.IO rejeita quando o servidor não responde dentro do prazo
      throw new MediaRequestError('TIMEOUT', 'O servidor demorou a responder. Verifique sua conexão.');
    }
    return unwrap(result);
  }
}