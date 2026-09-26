import type { types as mediasoup } from 'mediasoup-client';

export type RtpCapabilities = mediasoup.RtpCapabilities;
export type RtpParameters = mediasoup.RtpParameters;
export type DtlsParameters = mediasoup.DtlsParameters;
export type MediaKind = mediasoup.MediaKind;

export type TransportDirection = 'send' | 'recv';

/** De onde vem a mídia. Hoje só a tela; áudio do sistema entra como outra fonte no futuro */
export type MediaSource = 'screen';

export interface TransportInfo {
  id: string;
  iceParameters: mediasoup.IceParameters;
  iceCandidates: mediasoup.IceCandidate[];
  dtlsParameters: DtlsParameters;
}

/** Qualidade que o navegador de quem transmite está capturando de fato */
export interface VideoQuality {
  width: number;
  height: number;
  frameRate: number;
}

/** Qualidade escolhida por quem transmite no menu (1080p / 60 FPS, por exemplo) */
export interface QualityTarget {
  height: number;
  frameRate: number;
}

export interface ProducerInfo {
  producerId: string;
  userId: string;
  kind: MediaKind;
  source: MediaSource;
  /** O que o navegador de quem transmite está capturando de fato; pode oscilar */
  quality: VideoQuality | null;
  /** A qualidade escolhida no menu; estável, é por ela que as opções de quem assiste são nomeadas */
  target: QualityTarget | null;
}

export interface ConsumerInfo {
  id: string;
  producerId: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
  /** Verdadeiro quando quem transmite envia várias camadas e o espectador pode escolher entre elas */
  simulcast: boolean;
}

export interface SetPreferredLayersPayload {
  consumerId: string;
  spatialLayer: number;
}

export type MediaErrorCode =
  | 'NOT_IN_ROOM'
  | 'INVALID_PAYLOAD'
  | 'TRANSPORT_NOT_FOUND'
  | 'PRODUCER_NOT_FOUND'
  | 'CONSUMER_NOT_FOUND'
  | 'SCREEN_ALREADY_SHARED'
  | 'CANNOT_CONSUME'
  | 'INTERNAL_ERROR';

export type MediaResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MediaErrorCode; message: string };

export interface CreateTransportPayload {
  direction: TransportDirection;
}

export interface ConnectTransportPayload {
  transportId: string;
  dtlsParameters: DtlsParameters;
}

export interface ProducePayload {
  transportId: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
  source: MediaSource;
  quality?: VideoQuality;
  target?: QualityTarget;
}

export interface UpdateProducerQualityPayload {
  producerId: string;
  quality: VideoQuality;
  target: QualityTarget;
}

export interface ConsumePayload {
  producerId: string;
  rtpCapabilities: RtpCapabilities;
}