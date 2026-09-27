import { useServerStatusStore } from '../stores/server-status.store';
import { cn } from '../utils/cn';

const DOT = {
  checking: 'bg-text-disabled',
  online: 'bg-success',
  offline: 'bg-error',
} as const;

const LABEL = {
  checking: 'conectando…',
  online: 'servidor online',
  offline: 'servidor fora do ar',
} as const;

/** Pílula do cabeçalho com a latência real até a API */
export function ServerStatusPill() {
  const status = useServerStatusStore((s) => s.status);
  const ping = useServerStatusStore((s) => s.ping);

  return (
    <div
      title="Latência até o servidor"
      className={cn(
        'flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border px-[9px] font-mono text-[11.5px] leading-none font-medium text-text-primary',
        'md:h-[30px] md:gap-2 md:px-2.5 md:text-caption md:leading-none md:text-text-secondary',
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOT[status])} aria-hidden />
      <span className={cn(status === 'online' && 'sr-only md:not-sr-only')}>{LABEL[status]}</span>
      {status === 'online' && ping !== null && <span className="text-text-primary">{ping} ms</span>}
    </div>
  );
}
