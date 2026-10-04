import { Volume2, VolumeX } from 'lucide-react';

interface AudioToggleProps {
  muted: boolean;
  onToggle: () => void;
}

/** Liga ou desliga o som da transmissão para quem assiste */
export function AudioToggle({ muted, onToggle }: AudioToggleProps) {
  const Icon = muted ? VolumeX : Volume2;
  const label = muted ? 'Ativar som da transmissão' : 'Silenciar transmissão';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={label}
      title={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface text-text-secondary transition-colors duration-120 hover:bg-surface-hover hover:text-text-primary focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
    >
      <Icon size={14} aria-hidden />
    </button>
  );
}
