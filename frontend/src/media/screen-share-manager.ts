import type { types } from 'mediasoup-client';
import { MediaRequestError, type MediaSignaling } from './media-signaling';
import type { MediaSession } from './media-session';
import { buildEncodings, captureConstraints, getSharePreset, type SharePresetId } from './quality-presets';
import { displayMediaOptions } from './screen-share-config';

export interface CaptureQuality {
  width: number;
  height: number;
  frameRate: number;
}

export type ScreenShareState =
  | { status: 'idle' }
  | { status: 'starting' }
  /** Capturando e produzindo, mas a conexão WebRTC com o servidor ainda não fechou */
  | { status: 'connecting'; stream: MediaStream }
  | { status: 'live'; stream: MediaStream; quality: CaptureQuality | null };

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
  private stream: MediaStream | null = null;
  private producer: types.Producer | null = null;
  private transport: types.Transport | null = null;
  private qualityTimer: number | null = null;
  private disposed = false;

  private readonly session: MediaSession;
  private readonly signaling: MediaSignaling;
  private readonly listeners: ScreenShareListeners;

  constructor(session: MediaSession, signaling: MediaSignaling, presetId: SharePresetId, listeners: ScreenShareListeners) {
    this.session = session;
    this.signaling = signaling;
    this.presetId = presetId;
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

    // Diz ao codificador que é conteúdo com texto e detalhes finos, não uma câmera:
    // ele prioriza nitidez em vez de fluidez quando a banda aperta
    track.contentHint = 'detail';

    // Botão nativo "Parar compartilhamento" do navegador, ou janela compartilhada fechada
    track.addEventListener('ended', () => void this.stop());

    this.stream = stream;
    this.setState({ status: 'connecting', stream });

    try {
      const transport = await this.session.getSendTransport();
      this.watchTransport(transport);

      this.producer = await transport.produce({
        track,
        encodings: buildEncodings(preset),
        codecOptions: { videoGoogleStartBitrate: 1000 },
      });

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

    const targets = buildEncodings(getSharePreset(presetId));
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
    this.setState({ status: 'live', stream: this.stream, quality: this.getQuality() });

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