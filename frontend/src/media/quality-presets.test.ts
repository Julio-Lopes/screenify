import { describe, expect, it } from 'vitest';
import { buildEncodings, getSharePreset, SHARE_PRESETS } from './quality-presets';

describe('buildEncodings', () => {
  it('gera três camadas de simulcast: 1/4, 1/2 e a resolução cheia', () => {
    const encodings = buildEncodings(getSharePreset('1080p30'));
    expect(encodings.map((e) => e.scaleResolutionDownBy)).toEqual([4, 2, 1]);
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