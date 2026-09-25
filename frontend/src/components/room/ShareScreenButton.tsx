import { ScreenShare, ScreenShareOff } from 'lucide-react';
import type { ScreenShareState } from '../../media/screen-share-manager';
import { Button } from '../ui/Button';

interface ShareScreenButtonProps {
  state: ScreenShareState;
  supported: boolean;
  /** Nome de quem já está compartilhando, quando é outra pessoa */
  otherSharerName: string | null;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function ShareScreenButton({
  state,
  supported,
  otherSharerName,
  disabled,
  onStart,
  onStop,
}: ShareScreenButtonProps) {
  if (state.status === 'live' || state.status === 'connecting') {
    return (
      <Button variant="danger" size="sm" onClick={onStop}>
        <ScreenShareOff size={15} aria-hidden />
        <span className="hidden sm:inline">Parar</span>
      </Button>
    );
  }

  const blockedReason = !supported
    ? 'Seu navegador não permite compartilhar a tela'
    : otherSharerName
      ? `${otherSharerName} está compartilhando a tela`
      : null;

  return (
    <span title={blockedReason ?? undefined}>
      <Button
        size="sm"
        onClick={onStart}
        disabled={Boolean(blockedReason) || disabled}
        loading={state.status === 'starting'}
        loadingText="Iniciando…"
      >
        <ScreenShare size={15} aria-hidden />
        <span className="hidden sm:inline">Compartilhar tela</span>
      </Button>
    </span>
  );
}