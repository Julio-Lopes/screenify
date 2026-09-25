import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptLimiter } from '../../src/utils/attempt-limiter.js';

describe('AttemptLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bloqueia ao atingir o limite de falhas', () => {
    const limiter = new AttemptLimiter(3, 60_000);

    limiter.registerFailure('a');
    limiter.registerFailure('a');
    expect(limiter.isBlocked('a')).toBe(false);

    limiter.registerFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);
  });

  it('conta cada chave separadamente', () => {
    const limiter = new AttemptLimiter(1, 60_000);

    limiter.registerFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);
    expect(limiter.isBlocked('b')).toBe(false);
  });

  it('libera quando a janela de tempo vence', () => {
    const limiter = new AttemptLimiter(1, 60_000);
    limiter.registerFailure('a');

    vi.advanceTimersByTime(59_999);
    expect(limiter.isBlocked('a')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(limiter.isBlocked('a')).toBe(false);
  });

  it('zera a contagem com reset', () => {
    const limiter = new AttemptLimiter(1, 60_000);
    limiter.registerFailure('a');
    limiter.reset('a');

    expect(limiter.isBlocked('a')).toBe(false);
  });
});