import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle';

describe('throttle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('envia a primeira na hora e só a última do intervalo depois', () => {
    const fn = vi.fn();
    const send = throttle(fn, 50);

    for (let i = 1; i <= 10; i++) send(i);
    expect(fn.mock.calls).toEqual([[1]]);

    vi.advanceTimersByTime(50);
    expect(fn.mock.calls).toEqual([[1], [10]]);
  });

  it('com movimento contínuo, no máximo uma chamada a cada intervalo', () => {
    const fn = vi.fn();
    const send = throttle(fn, 50);

    // Um segundo de mouse a 60 eventos por segundo
    for (let i = 0; i < 60; i++) {
      send(i);
      vi.advanceTimersByTime(1000 / 60);
    }
    vi.advanceTimersByTime(50);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(21);
  });

  it('cancelar descarta o que estava esperando', () => {
    const fn = vi.fn();
    const send = throttle(fn, 50);
    send(1);
    send(2);
    send.cancel();
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[1]]);
  });
});