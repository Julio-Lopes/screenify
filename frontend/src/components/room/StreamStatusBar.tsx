import type { ReactNode } from 'react';
import { formatBitrate, METRIC_LIMITS, type StreamMetrics } from '../../media/stream-stats';
import { cn } from '../../utils/cn';

interface StreamStatusBarProps {
  metrics: StreamMetrics | null;
  /** "Transmitindo" para quem compartilha; "Assistindo Julio" para quem assiste */
  label: string;
}

const dash = '—';

/**
 * Status bar técnica do design system: números em mono tabular, atualizados a cada segundo.
 * Latência e perda acima dos limites aparecem como aviso.
 */
export function StreamStatusBar({ metrics, label }: StreamStatusBarProps) {
  const rttWarning = metrics?.rttMs != null && metrics.rttMs > METRIC_LIMITS.rttMs;
  const lossWarning = metrics?.packetLossPct != null && metrics.packetLossPct > METRIC_LIMITS.packetLossPct;

  return (
    <div
      role="status"
      aria-label="Métricas da transmissão"
      className="flex h-8 shrink-0 items-center gap-x-4 overflow-x-auto border-t border-border-subtle bg-surface px-4 font-mono text-[11px] font-medium whitespace-nowrap text-text-muted tabular-nums sm:px-6"
    >
      <span className="flex items-center gap-1.5 text-text-secondary">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        {label}
      </span>
      <Metric name="Resolução">
        {metrics?.width && metrics.height ? `${metrics.width}×${metrics.height}` : dash}
      </Metric>
      {/* Em telas menores, só qualidade e latência, como no design system */}
      <Metric name="FPS" className="hidden lg:inline">
        {metrics?.fps ?? dash}
      </Metric>
      <Metric name="Bitrate" className="hidden lg:inline">
        {metrics?.bitrateKbps != null ? formatBitrate(metrics.bitrateKbps) : dash}
      </Metric>
      <Metric name="RTT" warning={rttWarning} hint="Tempo de ida e volta até o servidor">
        {metrics?.rttMs != null ? `${metrics.rttMs} ms` : dash}
      </Metric>
      <Metric name="Perda" warning={lossWarning} hint="Pacotes perdidos no último segundo" className="hidden lg:inline">
        {metrics?.packetLossPct != null ? `${metrics.packetLossPct.toFixed(1)}%` : dash}
      </Metric>
      {lossWarning && <span className="text-warning-text">Conexão instável</span>}
    </div>
  );
}

interface MetricProps {
  name: string;
  warning?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}

function Metric({ name, warning, hint, className, children }: MetricProps) {
  return (
    <span title={hint} className={className}>
      {name} <span className={cn(warning ? 'text-warning-text' : 'text-text-primary')}>{children}</span>
    </span>
  );
}