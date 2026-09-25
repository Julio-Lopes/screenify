import { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenShareManager, type ScreenShareState } from '../media/screen-share-manager';
import { toast } from '../stores/toast.store';
import type { RoomMedia } from './useMediaSession';

interface ScreenShare {
  state: ScreenShareState;
  supported: boolean;
  start: () => void;
  stop: () => void;
}

export function useScreenShare(media: RoomMedia | null): ScreenShare {
  const [state, setState] = useState<ScreenShareState>({ status: 'idle' });
  const [manager, setManager] = useState<ScreenShareManager | null>(null);
  const mountedRef = useRef(true);

  // Declarado antes do efeito abaixo: ao desmontar, este cleanup roda primeiro
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!media) return;

    const instance = new ScreenShareManager(media.session, media.signaling, {
      onChange: setState,
      onError: (message) => toast('error', 'Não foi possível compartilhar a tela', message),
    });
    setManager(instance);
    setState({ status: 'idle' });

    return () => {
      const wasSharing = instance.getState().status !== 'idle';
      instance.dispose();
      // Só avisa quando a sessão foi trocada por uma reconexão, não quando a pessoa saiu da sala
      if (wasSharing && mountedRef.current) {
        toast('info', 'Transmissão interrompida', 'A conexão com a sala caiu. Compartilhe a tela de novo.');
      }
      setManager(null);
      setState({ status: 'idle' });
    };
  }, [media]);

  const start = useCallback(() => void manager?.start(), [manager]);
  const stop = useCallback(() => void manager?.stop(), [manager]);

  return { state, supported: ScreenShareManager.isSupported(), start, stop };
}