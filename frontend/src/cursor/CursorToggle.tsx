import { MousePointer2, MousePointer2Off } from 'lucide-react';

interface CursorToggleProps {
  visible: boolean;
  onToggle: () => void;
}

/** Mostra ou esconde os cursores das outras pessoas sobre a tela */
export function CursorToggle({ visible, onToggle }: CursorToggleProps) {
  const Icon = visible ? MousePointer2 : MousePointer2Off;
  const label = visible ? 'Esconder cursores dos participantes' : 'Mostrar cursores dos participantes';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={label}
      title={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface text-text-secondary transition-colors duration-120 hover:bg-surface-hover hover:text-text-primary focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
    >
      <Icon size={14} aria-hidden />
    </button>
  );
}