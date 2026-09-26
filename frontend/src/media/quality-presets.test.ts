import { describe, expect, it } from 'vitest';
import {
  actualLayerHeight,
  buildEncodings,
  getSharePreset,
  layerForMaxHeight,
  layerOptions,
  SHARE_PRESETS,
} from './quality-presets';

describe('buildEncodings', () => {
  it('gera três camadas de simulcast: 1/3, 2/3 e a resolução cheia', () => {
    const encodings = buildEncodings(getSharePreset('1080p30'));
    expect(encodings.map((e) => e.scaleResolutionDownBy)).toEqual([3, 1.5, 1]);
    expect(encodings.every((e) => e.active)).toBe(true);
  });

  it.each(SHARE_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s distribui o bitrate total entre as camadas ativas',
    (_id, preset) => {
      const total = buildEncodings(preset)
        .filter((e) => e.active)
        .reduce((sum, e) => sum + (e.maxBitrate ?? 0), 0);
      expect(Math.abs(total - preset.bitrate)).toBeLessThanOrEqual(2);
    },
  );

  it('desliga camadas menores que 180p', () => {
    expect(buildEncodings(getSharePreset('480p30')).map((e) => e.active)).toEqual([false, true, true]);
    expect(buildEncodings(getSharePreset('360p30')).map((e) => e.active)).toEqual([false, true, true]);
    expect(buildEncodings(getSharePreset('720p30')).map((e) => e.active)).toEqual([true, true, true]);
  });

  it('limita o FPS de todas as camadas ao da qualidade escolhida', () => {
    expect(buildEncodings(getSharePreset('720p60')).map((e) => e.maxFramerate)).toEqual([60, 60, 60]);
  });
});

describe('layerOptions', () => {
  it.each([
    [1080, ['1080p', '720p', '360p']],
    [720, ['720p', '480p', '240p']],
    [480, ['480p', '320p']],
    [360, ['360p', '240p']],
    [700, ['700p', '467p', '233p']],
  ])('uma live de %ip oferece %j', (height, labels) => {
    expect(layerOptions(height).map((option) => option.label)).toEqual(labels);
  });
});

describe('layerForMaxHeight', () => {
  it('sem escolha, fica com a maior resolução da live', () => {
    expect(layerForMaxHeight(null, layerOptions(1080))).toBe(2);
  });

  it('mantém a resolução escolhida quando quem transmite muda de qualidade', () => {
    // Escolheu 720p numa live 1080p...
    expect(layerForMaxHeight(720, layerOptions(1080))).toBe(1);
    // ...e a live passou a 720p: continua em 720p, agora a camada cheia
    expect(layerForMaxHeight(720, layerOptions(720))).toBe(2);
  });

  it('usa a maior camada que não passa do limite escolhido', () => {
    // 480p escolhido numa live 1080p (360, 720, 1080): fica em 360p
    expect(layerForMaxHeight(480, layerOptions(1080))).toBe(0);
  });

  it('usa a menor que existir quando a live é menor que tudo', () => {
    expect(layerForMaxHeight(200, layerOptions(480))).toBe(1);
  });
});

describe('actualLayerHeight', () => {
  it('calcula a altura real de cada camada a partir da captura', () => {
    expect(actualLayerHeight(854, 2)).toBe(854);
    expect(actualLayerHeight(854, 1)).toBe(569);
    expect(actualLayerHeight(854, 0)).toBe(285);
  });
});