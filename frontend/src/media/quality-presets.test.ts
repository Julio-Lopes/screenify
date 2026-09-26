import { describe, expect, it } from 'vitest';
import { buildEncodings, effectiveLayer, getSharePreset, layerOptions, SHARE_PRESETS } from './quality-presets';

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

describe('effectiveLayer', () => {
  it('usa a camada preferida quando ela existe', () => {
    expect(effectiveLayer(1, layerOptions(1080))).toBe(1);
  });

  it('cai para a menor camada existente quando a preferida não existe na live', () => {
    // Numa live 480p a camada 0 (160p) está desligada: quem pediu a menor recebe a menor que existe
    expect(effectiveLayer(0, layerOptions(480))).toBe(1);
  });
});