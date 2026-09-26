import { describe, expect, it } from 'vitest';
import { toNormalized, videoContentRect } from './geometry';

const video = (clientWidth: number, clientHeight: number, videoWidth = 1920, videoHeight = 1080) => ({
  clientWidth,
  clientHeight,
  videoWidth,
  videoHeight,
});

describe('videoContentRect', () => {
  it('ocupa a área toda quando a proporção bate', () => {
    expect(videoContentRect(video(1600, 900))).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
  });

  it('desconta as faixas pretas de cima e de baixo', () => {
    const rect = videoContentRect(video(1000, 1000));
    expect(rect.x).toBe(0);
    expect(rect.width).toBe(1000);
    expect(rect.y).toBeCloseTo(218.75);
    expect(rect.height).toBeCloseTo(562.5);
  });

  it('desconta as faixas pretas das laterais', () => {
    expect(videoContentRect(video(2000, 900))).toEqual({ x: 200, y: 0, width: 1600, height: 900 });
  });

  it('usa a caixa inteira enquanto o vídeo ainda não tem tamanho', () => {
    expect(videoContentRect(video(800, 600, 0, 0))).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });
});

describe('toNormalized', () => {
  const bounds = { left: 100, top: 50, width: 800, height: 450 };

  it('converte a posição na tela para 0..1 relativo à imagem', () => {
    expect(toNormalized(500, 275, bounds)).toEqual({ x: 0.5, y: 0.5 });
    expect(toNormalized(100, 50, bounds)).toEqual({ x: 0, y: 0 });
  });

  it('o mesmo ponto da imagem dá o mesmo valor em qualquer tamanho de exibição', () => {
    const small = toNormalized(100 + 200, 50 + 100, bounds);
    const large = toNormalized(0 + 480, 0 + 240, { left: 0, top: 0, width: 1920, height: 1080 });
    expect(small).toEqual({ x: 0.25, y: 0.2222 });
    expect(large).toEqual({ x: 0.25, y: 0.2222 });
  });

  it('segura o ponteiro dentro da imagem ao arrastar para fora', () => {
    expect(toNormalized(-50, 9999, bounds)).toEqual({ x: 0, y: 1 });
  });
});