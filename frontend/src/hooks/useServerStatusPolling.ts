import { useEffect } from 'react';
import { env } from '../config/env';
import { useServerStatusStore } from '../stores/server-status.store';

const INTERVAL_MS = 10_000;
const TIMEOUT_MS = 5_000;

async function measurePing(): Promise<number> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const start = performance.now();
    const response = await fetch(`${env.apiUrl}/health`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Math.round(performance.now() - start);
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Mede a latência até a API pelo /health e mantém o status do servidor atualizado.
 * Deve ser chamado uma única vez, no layout. Com a aba em segundo plano, para de medir.
 */
export function useServerStatusPolling() {
  useEffect(() => {
    const { setOnline, setOffline } = useServerStatusStore.getState();
    let cancelled = false;
    let timer: number | undefined;

    async function check(warmUp = false) {
      try {
        // A primeira requisição inclui DNS, TCP e TLS: descarta e mede de novo
        if (warmUp) await measurePing();
        const ping = await measurePing();
        if (!cancelled) setOnline(ping);
      } catch {
        if (!cancelled) setOffline();
      }
      if (!cancelled && document.visibilityState === 'visible') {
        timer = window.setTimeout(() => void check(), INTERVAL_MS);
      }
    }

    function onVisibilityChange() {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') void check();
    }

    void check(true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
