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

/*
 * Modo de conteúdo. Muda como o codificador se comporta quando falta CPU ou banda:
 * - 'text': apresentações, código, documentos. Mantém a nitidez e sacrifica o FPS.
 * - 'game': jogos e vídeos. Mantém o FPS, sacrifica um pouco de nitidez e usa mais bitrate.
 */
export type ShareMode = 'text' | 'game';

export const DEFAULT_SHARE_MODE: ShareMode = 'text';

export const SHARE_MODES: readonly { id: ShareMode; label: string; hint: string }[] = [
  { id: 'text', label: 'Texto e apresentações', hint: 'Prioriza nitidez' },
  { id: 'game', label: 'Jogos e vídeos', hint: 'Prioriza fluidez' },
];

/**
 * Bitrate total no modo jogo. Cenas de jogo mudam quase inteiras a cada quadro e precisam de bem
 * mais bits que uma tela de texto para não virar borrão; a camada cheia fica com ~75% disso.
 */
const GAME_BITRATE: Record<SharePresetId, number> = {
  '1080p60': 14_000_000,
  '1080p30': 9_000_000,
  '720p60': 8_000_000,
  '720p30': 5_000_000,
  '480p30': 2_500_000,
  '360p30': 1_400_000,
};

/** Bitrate total estimado de uma qualidade no modo escolhido */
export function presetBitrate(preset: SharePreset, mode: ShareMode = DEFAULT_SHARE_MODE): number {
  return mode === 'game' ? GAME_BITRATE[preset.id] : preset.bitrate;
}

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
 * Simulcast: quem transmite envia a mesma tela em três camadas (1/3, 2/3 e a resolução cheia).
 * Numa tela 1080p isso dá 360p, 720p e 1080p. O servidor entrega a cada espectador
 * a maior camada que a conexão dele aguenta, até o teto que ele escolher.
 */
export type SpatialLayer = 0 | 1 | 2;

export const HIGHEST_LAYER: SpatialLayer = 2;

const LAYERS = [
  // scale: divisor da resolução; weight: fatia do bitrate (a maior parte vai para a camada cheia).
  // gameWeight: no modo jogo, a camada cheia (a que quase todo mundo assiste) leva ainda mais
  { layer: 0, scale: 3, weight: 0.1, gameWeight: 0.07 },
  { layer: 1, scale: 1.5, weight: 0.25, gameWeight: 0.18 },
  { layer: 2, scale: 1, weight: 0.65, gameWeight: 0.75 },
] as const satisfies readonly { layer: SpatialLayer; scale: number; weight: number; gameWeight: number }[];

/** Camadas menores que isso não ajudam ninguém a ler uma tela: ficam desligadas */
const MIN_LAYER_HEIGHT = 180;

export interface EncodingOptions {
  mode?: ShareMode;
  /**
   * Codec escolhido para a transmissão (ex.: 'video/H264'). Os encoders de H264 por hardware
   * geralmente não suportam camadas temporais, e pedir L1T3 pode fazer o navegador cair
   * para o encoder em software: com H264, as camadas temporais ficam de fora.
   */
  mimeType?: string;
}

export function buildEncodings(
  preset: SharePreset,
  { mode = DEFAULT_SHARE_MODE, mimeType }: EncodingOptions = {},
): types.RtpEncodingParameters[] {
  const total = presetBitrate(preset, mode);
  const layers = LAYERS.map((layer) => ({
    ...layer,
    share: mode === 'game' ? layer.gameWeight : layer.weight,
    active: preset.height / layer.scale >= MIN_LAYER_HEIGHT,
  }));
  const activeWeight = layers.reduce((sum, layer) => sum + (layer.active ? layer.share : 0), 0);
  const temporalLayers = mimeType?.toLowerCase() !== 'video/h264';

  return layers.map((layer) => ({
    scaleResolutionDownBy: layer.scale,
    maxFramerate: preset.frameRate,
    maxBitrate: Math.round((total * layer.share) / activeWeight),
    active: layer.active,
    // Três camadas temporais dentro de cada camada: permite reduzir o FPS sem trocar de resolução
    ...(temporalLayers && { scalabilityMode: 'L1T3' }),
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

export interface LayerOption {
  layer: SpatialLayer;
  height: number;
  label: string;
}

/**
 * As camadas que existem de fato numa transmissão, da maior para a menor, calculadas
 * a partir da altura real capturada. Numa live 1080p: 1080p, 720p e 360p.
 */
export function layerOptions(height: number): LayerOption[] {
  return LAYERS.map(({ layer, scale }) => ({ layer, height: Math.round(height / scale) }))
    .filter((option) => option.height >= MIN_LAYER_HEIGHT)
    .reverse()
    .map((option) => ({ ...option, label: `${option.height}p` }));
}

/**
 * A camada para a resolução escolhida por quem assiste: a maior que não passa dela.
 * Sem escolha (null), a maior da live. Se a live for menor que tudo, a menor que existir.
 */
export function layerForMaxHeight(maxHeight: number | null, options: LayerOption[]): SpatialLayer {
  if (maxHeight === null) return options[0]?.layer ?? HIGHEST_LAYER;
  // As opções vêm da maior para a menor: a primeira que cabe no limite é a certa
  return options.find((option) => option.height <= maxHeight)?.layer ?? options.at(-1)?.layer ?? HIGHEST_LAYER;
}

/** Altura que a camada tem de fato, a partir do que quem transmite está capturando agora */
export function actualLayerHeight(capturedHeight: number, layer: SpatialLayer): number {
  const scale = LAYERS.find((entry) => entry.layer === layer)?.scale ?? 1;
  return Math.round(capturedHeight / scale);
}

export function qualityLabel(quality: { height: number; frameRate: number }): string {
  return `${quality.height}p / ${quality.frameRate} FPS`;
}