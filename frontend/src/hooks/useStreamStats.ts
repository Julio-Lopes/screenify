import { useEffect, useState } from 'react';
import { readStreamStats, type StatsSample, type StreamMetrics } from '../media/stream-stats';

/** O design system pede atualização a cada segundo */
const INTERVAL_MS = 1000;

/**
 * Lê o getStats() da transmissão uma vez por segundo enquanto ela está ativa.
 * `getStats` devolve null quando não há o que medir; `active` liga e desliga a leitura.
 */
export function useStreamStats(
  getStats: () => Promise<RTCStatsReport> | null,
  direction: 'outbound' | 'inbound',
  active: boolean,
): StreamMetrics | null {
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);

  useEffect(() => {
    if (!active) {
      setMetrics(null);
      return;
    }

    let previous: StatsSample | null = null;
    let cancelled = false;

    const read = async () => {
      const report = await getStats()?.catch(() => null);
      if (!report || cancelled) return;
      // RTCStatsReport é um Map de objetos com campos que variam por tipo de estatística
      const result = readStreamStats(report.values(), direction, previous);
      previous = result.sample;
      setMetrics(result.metrics);
    };

    void read();
    const timer = setInterval(() => void read(), INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [getStats, direction, active]);

  return metrics;
}