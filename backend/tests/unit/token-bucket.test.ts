import { describe, expect, it } from 'vitest';
import { TokenBucket } from '../../src/utils/token-bucket.js';

describe('TokenBucket', () => {
  it('permite a rajada inicial e depois bloqueia', () => {
    let now = 0;
    const bucket = new TokenBucket(3, 1, () => now);

    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, true, false]);
  });

  it('devolve fichas com o passar do tempo, sem passar da capacidade', () => {
    let now = 0;
    const bucket = new TokenBucket(2, 10, () => now);
    bucket.take();
    bucket.take();
    expect(bucket.take()).toBe(false);

    now += 100; // 0,1 s a 10 por segundo: uma ficha
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(false);

    now += 60_000; // muito tempo depois: volta só até a capacidade
    expect([bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, false]);
  });
});