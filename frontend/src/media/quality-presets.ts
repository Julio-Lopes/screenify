import type { types } from 'mediasoup-client';

export type SharePresetId = '1080p60' | '1080p30' | '720p60' | '720p30' | '480p30' | '360p30';

export interface SharePreset {
  id: SharePresetId;
  resolution: string;
  frameRate: number;
  width: number;
  height: number;
  /** Bitrate total estimado, somando as camadas (bits por segundo) */
  bitrate: number;
}

/** As opções do prompt, com os bitrates estimados do Quality Selector do design system */
const PRESETS: Record<SharePresetId, SharePreset> = {
  '1080p60': { id: '1080p60', resolution: '1080p', frameRate: 60, width: 1920, height: 1080, bitrate: 8_200_000 },
  '1080p30': { id: '1080p30', resolution: '1080p', frameRate: 30, width: 1920, height: 1080, bitrate: 5_100_000 },
  '720p60': { id: '720p60', resolution: '720p', frameRate: 60, width: 1280, height: 720, bitrate: 4_600_000 },
  '720p30': { id: '720p30', resolution: '720p', frameRate: 30, width: 1280, height: 720, bitrate: 2_800_000 },
  '480p30': { id: '480p30', resolution: '480p', frameRate: 30, width: 854, height: 480, bitrate: 1_400_000 },
  '360p30': { id: '360p30', resolution: '360p', frameRate: 30, width: 640, height: 360, bitrate: 800_000 },
};

/** Na ordem do menu: da maior qualidade para a menor */
export const SHARE_PRESETS: readonly SharePreset[] = Object.values(PRESETS);

export const DEFAULT_SHARE_PRESET: SharePresetId = '1080p30';

export function getSharePreset(id: SharePresetId): SharePreset {
  return PRESETS[id] ?? PRESETS[DEFAULT_SHARE_PRESET];
}

export function presetLabel(preset: SharePreset): string {
  return `${preset.resolution} / ${preset.frameRate} FPS`;
}

export function formatMbps(bitsPerSecond: number): string {
  return `~${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
}

/*
 * Simulcast: quem transmite envia a mesma tela em três camadas (1/4, 1/2 e a resolução cheia).
 * O servidor entrega a cada espectador a maior camada que a conexão dele aguenta.
 */
const LAYERS = [
  // scale: divisor da resolução; weight: fatia do bitrate (quase tudo vai para a camada cheia)
  { scale: 4, weight: 0.05 },
  { scale: 2, weight: 0.2 },
  { scale: 1, weight: 0.75 },
] as const;

/** Camadas menores que isso não ajudam ninguém a ler uma tela: ficam desligadas */
const MIN_LAYER_HEIGHT = 180;

export function buildEncodings(preset: SharePreset): types.RtpEncodingParameters[] {
  const layers = LAYERS.map((layer) => ({ ...layer, active: preset.height / layer.scale >= MIN_LAYER_HEIGHT }));
  const activeWeight = layers.reduce((sum, layer) => sum + (layer.active ? layer.weight : 0), 0);

  return layers.map((layer) => ({
    scaleResolutionDownBy: layer.scale,
    maxFramerate: preset.frameRate,
    maxBitrate: Math.round((preset.bitrate * layer.weight) / activeWeight),
    active: layer.active,
    // Três camadas temporais dentro de cada camada: permite reduzir o FPS sem trocar de resolução
    scalabilityMode: 'L1T3',
  }));
}

/** Restrições da captura para a qualidade escolhida: são tetos, o navegador pode entregar menos */
export function captureConstraints(preset: SharePreset): MediaTrackConstraints {
  return {
    width: { max: preset.width },
    height: { max: preset.height },
    frameRate: { ideal: preset.frameRate, max: preset.frameRate },
  };
}

/** Qualidade que o espectador escolhe receber. É um teto: a rede ainda pode baixar mais */
export type ViewQuality = 'auto' | 'medium' | 'low';

export const VIEW_QUALITIES: readonly { id: ViewQuality; label: string; hint: string; spatialLayer: number }[] = [
  { id: 'auto', label: 'Automática', hint: 'Melhor possível', spatialLayer: 2 },
  { id: 'medium', label: 'Média', hint: '½ resolução', spatialLayer: 1 },
  { id: 'low', label: 'Baixa', hint: '¼ resolução', spatialLayer: 0 },
];