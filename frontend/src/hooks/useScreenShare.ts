import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharePresetId, ShareMode } from '../media/quality-presets';
import { ScreenShareManager, type ScreenShareState } from '../media/screen-share-manager';
import { usePreferencesStore } from '../stores/preferences.store';
import { toast } from '../stores/toast.store';
import type { RoomMedia } from './useMediaSession';

interface ScreenShare {
  state: ScreenShareState;
  supported: boolean;
  preset: SharePresetId;
  mode: ShareMode;
  start: () => void;
  stop: () => void;
  setPreset: (preset: SharePresetId) => void;
  setMode: (mode: ShareMode) => void;
  getStats: () => Promise<RTCStatsReport> | null;
}

export function useScreenShare(media: RoomMedia | null): ScreenShare {
  const [state, setState] = useState<ScreenShareState>({ status: 'idle' });
  const [manager, setManager] = useState<ScreenShareManager | null>(null);
  const preset = usePreferencesStore((s) => s.sharePreset);
  const savePreset = usePreferencesStore((s) => s.setSharePreset);
  const mode = usePreferencesStore((s) => s.shareMode);
  const saveMode = usePreferencesStore((s) => s.setShareMode);
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

    // Lê a preferência do momento sem fazer dela uma dependência: trocar a qualidade não recria o manager
    const { sharePreset, shareMode } = usePreferencesStore.getState();
    const instance = new ScreenShareManager(media.session, media.signaling, sharePreset, shareMode, {
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
  const setPreset = useCallback(
    (next: SharePresetId) => {
      savePreset(next);
      void manager?.setPreset(next);
    },
    [manager, savePreset],
  );

  const setMode = useCallback(
    (next: ShareMode) => {
      saveMode(next);
      void manager?.setMode(next);
    },
    [manager, saveMode],
  );

  const getStats = useCallback(() => manager?.getStats() ?? null, [manager]);

  return { state, supported: ScreenShareManager.isSupported(), preset, mode, start, stop, setPreset, setMode, getStats };
}