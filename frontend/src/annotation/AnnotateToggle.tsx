import { Pencil } from 'lucide-react';
import { cn } from '../utils/cn';

interface AnnotateToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

/** Liga e desliga o modo de desenho sobre a tela */
export function AnnotateToggle({ enabled, onToggle }: AnnotateToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? 'Parar de anotar (Esc)' : 'Anotar sobre a tela'}
      className={cn(
        'flex h-7 cursor-pointer items-center gap-1.5 rounded-sm border px-2 text-caption font-medium transition-colors duration-120',
        'focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none',
        enabled
          ? 'border-primary bg-primary-soft text-text-primary'
          : 'border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Pencil size={13} aria-hidden />
      {enabled ? 'Anotar' : 'Anotar'}
    </button>
  );
}