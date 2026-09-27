import type { QualityTarget, VideoQuality } from '@screenify/shared';
import type { types } from 'mediasoup-client';
import { MediaRequestError, type MediaSignaling } from './media-signaling';
import type { MediaSession } from './media-session';
import { chooseCodec } from './codec-selection';
import {
  buildEncodings,
  captureConstraints,
  getSharePreset,
  type SharePresetId,
  type ShareMode,
} from './quality-presets';
import { displayMediaOptions } from './screen-share-config';

export type CaptureQuality = VideoQuality;

export type ScreenShareState =
  | { status: 'idle' }
  | { status: 'starting' }
  /** Capturando e produzindo, mas a conexão WebRTC com o servidor ainda não fechou */
  | { status: 'connecting'; stream: MediaStream }
  | { status: 'live'; stream: MediaStream; quality: CaptureQuality | null; codec: CodecInfo };

/** Codec em uso e se o navegador indicou codificação por hardware ao escolhê-lo */
export interface CodecInfo {
  mimeType: string;
  hardware: boolean;
}

interface ScreenShareListeners {
  onChange: (state: ScreenShareState) => void;
  onError: (message: string) => void;
}

/** De quanto em quanto tempo a qualidade real da captura é conferida */
const QUALITY_CHECK_INTERVAL_MS = 2000;

/**
 * Cuida de todo o ciclo de compartilhar a tela: pedir a captura ao navegador,
 * transmitir pelo mediasoup em simulcast, trocar a qualidade, acompanhar o que o
 * navegador entrega de fato, reagir ao botão nativo "Parar compartilhamento" e encerrar.
 */
export class ScreenShareManager {
  private state: ScreenShareState = { status: 'idle' };
  private presetId: SharePresetId;
  private mode: ShareMode;
  private codecInfo: CodecInfo = { mimeType: 'video/VP8', hardware: false };
  private stream: MediaStream | null = null;
  private producer: types.Producer | null = null;
  private transport: types.Transport | null = null;
  private qualityTimer: number | null = null;
  private disposed = false;

  private readonly session: MediaSession;
  private readonly signaling: MediaSignaling;
  private readonly listeners: ScreenShareListeners;

  constructor(
    session: MediaSession,
    signaling: MediaSignaling,
    presetId: SharePresetId,
    mode: ShareMode,
    listeners: ScreenShareListeners,
  ) {
    this.session = session;
    this.signaling = signaling;
    this.presetId = presetId;
    this.mode = mode;
    this.listeners = listeners;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  }

  getState(): ScreenShareState {
    return this.state;
  }

  /** Qualidade que o navegador está entregando de fato, que pode ser menor que a pedida */
  getQuality(): CaptureQuality | null {
    const settings = this.stream?.getVideoTracks()[0]?.getSettings();
    if (!settings?.width || !settings.height) return null;

    return {
      width: settings.width,
      height: settings.height,
      frameRate: Math.round(settings.frameRate ?? 0),
    };
  }

  /** A qualidade escolhida no menu, que nomeia as opções de quem assiste */
  private getTarget(): QualityTarget {
    const preset = getSharePreset(this.presetId);
    return { height: preset.height, frameRate: preset.frameRate };
  }

  /** Relatório do WebRTC da transmissão, para as métricas; null quando não há transmissão */
  getStats(): Promise<RTCStatsReport> | null {
    return this.producer?.getStats() ?? null;
  }

  async start(): Promise<void> {
    if (this.state.status !== 'idle' || this.disposed) return;
    this.setState({ status: 'starting' });
    const preset = getSharePreset(this.presetId);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions(preset));
    } catch (error) {
      this.setState({ status: 'idle' });
      // Cancelar a janela de escolha não é erro: a pessoa desistiu
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
        this.listeners.onError('O navegador não conseguiu capturar a tela.');
      }
      return;
    }

    const track = stream.getVideoTracks()[0];
    if (!track || this.disposed) {
      stream.getTracks().forEach((t) => t.stop());
      this.setState({ status: 'idle' });
      return;
    }

    this.applyContentHint(track);

    // Botão nativo "Parar compartilhamento" do navegador, ou janela compartilhada fechada
    track.addEventListener('ended', () => void this.stop());

    this.stream = stream;
    this.setState({ status: 'connecting', stream });

    try {
      const transport = await this.session.getSendTransport();
      this.watchTransport(transport);

      // O codec só pode ser escolhido aqui: trocar depois exigiria um novo Producer
      const device = await this.session.getDevice();
      const { codec, hardware } = await chooseCodec(device, preset, this.mode);
      this.codecInfo = { mimeType: codec?.mimeType ?? 'video/VP8', hardware };

      this.producer = await transport.produce({
        track,
        codec,
        encodings: buildEncodings(preset, { mode: this.mode, mimeType: this.codecInfo.mimeType }),
        // No modo jogo começa mais alto: com 1 Mbps, os primeiros segundos ficam borrados até a rede ser medida
        codecOptions: { videoGoogleStartBitrate: this.mode === 'game' ? 3000 : 1000 },
        appData: { quality: this.getQuality() ?? undefined, target: this.getTarget() },
      });

      await this.applyDegradationPreference();

      if (transport.connectionState === 'connected') {
        this.goLive();
      }
    } catch (error) {
      this.releaseCapture();
      this.setState({ status: 'idle' });
      this.listeners.onError(this.describeError(error));
    }
  }

  /**
   * Troca a qualidade. Durante a transmissão, ajusta a captura com applyConstraints e os limites
   * de cada camada do simulcast, sem interromper quem está assistindo.
   */
  async setPreset(presetId: SharePresetId): Promise<void> {
    this.presetId = presetId;
    const track = this.stream?.getVideoTracks()[0];
    if (!track || !this.producer) return;

    const preset = getSharePreset(presetId);
    try {
      await track.applyConstraints(captureConstraints(preset));
      await this.applyEncodings(preset.id);
    } catch {
      this.listeners.onError('O navegador não aceitou essa qualidade para a tela escolhida.');
    }
    this.refreshQuality();
    // Mesmo que a captura não mude de tamanho, a qualidade escolhida mudou: a sala precisa saber
    this.publishQuality();
  }

  /**
   * Troca o modo durante a transmissão. O comportamento do codificador e os bitrates mudam na hora;
   * o codec (VP8 ou H264) só muda na próxima vez que a pessoa começar a compartilhar.
   */
  async setMode(mode: ShareMode): Promise<void> {
    this.mode = mode;
    const track = this.stream?.getVideoTracks()[0];
    if (!track || !this.producer) return;

    this.applyContentHint(track);
    try {
      await this.applyEncodings(this.presetId);
      await this.applyDegradationPreference();
    } catch {
      this.listeners.onError('O navegador não aceitou trocar o modo durante a transmissão.');
    }
  }

  getCodecInfo(): CodecInfo {
    return this.codecInfo;
  }

  async stop(): Promise<void> {
    const producer = this.producer;
    this.producer = null;
    this.releaseCapture();

    if (producer) {
      producer.close();
      await this.signaling.closeProducer(producer.id).catch(() => undefined);
    }
    if (!this.disposed) {
      this.setState({ status: 'idle' });
    }
  }

  /** Encerra tudo sem avisar o servidor: usado quando a conexão com a sala acabou */
  dispose(): void {
    this.disposed = true;
    this.producer?.close();
    this.producer = null;
    this.releaseCapture();
  }

  /** Atualiza bitrate, FPS e camadas ativas direto no RTCRtpSender, sem renegociar a conexão */
  private async applyEncodings(presetId: SharePresetId): Promise<void> {
    const sender = this.producer?.rtpSender;
    if (!sender) return;

    const targets = buildEncodings(getSharePreset(presetId), { mode: this.mode, mimeType: this.codecInfo.mimeType });
    const parameters = sender.getParameters();
    parameters.encodings.forEach((encoding, index) => {
      const target = targets[index];
      if (!target) return;
      encoding.active = target.active ?? true;
      encoding.maxBitrate = target.maxBitrate;
      encoding.maxFramerate = target.maxFramerate;
    });
    await sender.setParameters(parameters);
  }

  /**
   * 'motion': quando falta CPU ou banda, o codificador reduz a resolução e mantém o FPS (jogos).
   * 'detail': mantém a nitidez e derruba o FPS (texto, código, slides).
   */
  private applyContentHint(track: MediaStreamTrack): void {
    track.contentHint = this.mode === 'game' ? 'motion' : 'detail';
  }

  /**
   * Reforça a mesma escolha direto no RTCRtpSender. O contentHint já define o padrão, mas
   * alguns navegadores só respeitam a preferência explícita. Quem não suporta ignora.
   */
  private async applyDegradationPreference(): Promise<void> {
    const sender = this.producer?.rtpSender;
    if (!sender) return;
    const parameters = sender.getParameters() as RTCRtpSendParameters & { degradationPreference?: string };
    parameters.degradationPreference = this.mode === 'game' ? 'maintain-framerate' : 'maintain-resolution';
    await sender.setParameters(parameters).catch(() => undefined);
  }

  private watchTransport(transport: types.Transport): void {
    if (this.transport === transport) return;
    this.transport = transport;

    transport.on('connectionstatechange', (connectionState) => {
      if (connectionState === 'connected' && this.state.status === 'connecting') {
        this.goLive();
      }
      if (connectionState === 'failed' && this.producer) {
        void this.stop();
        this.listeners.onError(
          'Não foi possível conectar a transmissão ao servidor. Uma rede ou firewall pode estar bloqueando a mídia.',
        );
      }
    });
  }

  private goLive(): void {
    if (!this.stream) return;
    this.setState({ status: 'live', stream: this.stream, quality: this.getQuality(), codec: this.codecInfo });

    // A qualidade real muda sem aviso: janela redimensionada, troca de janela, máquina sobrecarregada
    this.qualityTimer ??= window.setInterval(() => this.refreshQuality(), QUALITY_CHECK_INTERVAL_MS);
  }

  private refreshQuality(): void {
    if (this.state.status !== 'live') return;

    const next = this.getQuality();
    const current = this.state.quality;
    const changed =
      next?.width !== current?.width || next?.height !== current?.height || next?.frameRate !== current?.frameRate;

    if (changed) {
      this.setState({ ...this.state, quality: next });
      this.publishQuality();
    }
  }

  /** Informa a sala sobre a qualidade real e a escolhida */
  private publishQuality(): void {
    const quality = this.getQuality();
    if (quality && this.producer) {
      void this.signaling.updateProducerQuality(this.producer.id, quality, this.getTarget()).catch(() => undefined);
    }
  }

  private releaseCapture(): void {
    if (this.qualityTimer !== null) {
      window.clearInterval(this.qualityTimer);
      this.qualityTimer = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private describeError(error: unknown): string {
    if (error instanceof MediaRequestError) return error.message;
    if (error instanceof Error && error.message) return error.message;
    return 'Não foi possível iniciar a transmissão.';
  }

  private setState(state: ScreenShareState): void {
    this.state = state;
    this.listeners.onChange(state);
  }
}