import type { Point } from '@screenify/shared';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Altura de referência da espessura: um traço de 4 tem 4 px numa tela de 1080 de altura */
export const REFERENCE_HEIGHT = 1080;

/**
 * Onde a imagem aparece de fato dentro do <video>. Com object-contain sobram faixas pretas
 * nas laterais ou em cima e embaixo; as coordenadas normalizadas são relativas só à imagem.
 */
export function videoContentRect(
  video: Pick<HTMLVideoElement, 'clientWidth' | 'clientHeight' | 'videoWidth' | 'videoHeight'>,
): Rect {
  const boxWidth = video.clientWidth;
  const boxHeight = video.clientHeight;
  const { videoWidth, videoHeight } = video;

  if (!videoWidth || !videoHeight || !boxWidth || !boxHeight) {
    return { x: 0, y: 0, width: boxWidth, height: boxHeight };
  }

  const videoRatio = videoWidth / videoHeight;

  // Caixa mais "larga" que o vídeo: a imagem ocupa a altura toda e sobram faixas nas laterais
  if (boxWidth / boxHeight > videoRatio) {
    const width = boxHeight * videoRatio;
    return { x: (boxWidth - width) / 2, y: 0, width, height: boxHeight };
  }

  // Caixa mais "alta" que o vídeo: a imagem ocupa a largura toda e sobram faixas em cima e embaixo
  const height = boxWidth / videoRatio;
  return { x: 0, y: (boxHeight - height) / 2, width: boxWidth, height };
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** 4 casas decimais: 0,1 px de precisão numa tela 1080p, e mensagens menores na Fase 12 */
const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** Converte a posição do ponteiro (px na tela) para a coordenada normalizada da imagem */
export function toNormalized(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): Point {
  return {
    x: round(clamp((clientX - bounds.left) / bounds.width)),
    y: round(clamp((clientY - bounds.top) / bounds.height)),
  };
}

/** Distância entre dois pontos normalizados, medida em pixels da área exibida */
export function pixelDistance(a: Point, b: Point, size: { width: number; height: number }): number {
  return Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height);
}