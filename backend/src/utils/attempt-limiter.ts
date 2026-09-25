interface Window {
  failures: number;
  startedAt: number;
}

/**
 * Conta falhas por chave numa janela fixa de tempo.
 * Vive em memória: basta para um único servidor, que é o caso do Screenify.
 */
export class AttemptLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
  ) {}

  isBlocked(key: string): boolean {
    const window = this.getActiveWindow(key);
    return window !== null && window.failures >= this.maxFailures;
  }

  registerFailure(key: string): void {
    const window = this.getActiveWindow(key);
    if (window) {
      window.failures++;
    } else {
      this.windows.set(key, { failures: 1, startedAt: Date.now() });
    }
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  /** Remove janelas vencidas para o Map não crescer para sempre */
  prune(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= this.windowMs) {
        this.windows.delete(key);
      }
    }
  }

  private getActiveWindow(key: string): Window | null {
    const window = this.windows.get(key);
    if (!window) return null;

    if (Date.now() - window.startedAt >= this.windowMs) {
      this.windows.delete(key);
      return null;
    }
    return window;
  }
}