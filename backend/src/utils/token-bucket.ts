/**
 * Balde de fichas: começa cheio, cada ação gasta uma ficha, e as fichas voltam aos poucos.
 * Permite rajadas curtas (entrar na sala dispara vários eventos de uma vez) e ao mesmo tempo
 * limita o ritmo sustentado.
 */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.updatedAt = now();
  }

  /** Gasta uma ficha; devolve false se o balde está vazio */
  take(): boolean {
    const now = this.now();
    const elapsedSeconds = (now - this.updatedAt) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.updatedAt = now;

    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}