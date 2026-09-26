import type { types } from 'mediasoup-client';
import { useCallback, useEffect, useState } from 'react';
import { VIEW_QUALITIES, type ViewQuality } from '../media/quality-presets';
import { usePreferencesStore } from '../stores/preferences.store';
import { toast } from '../stores/toast.store';
import type { RoomMedia } from './useMediaSession';

export type ScreenViewState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'playing'; stream: MediaStream; consumerId: string; simulcast: boolean }
  | { status: 'error'; message: string };

interface ScreenView {
  state: ScreenViewState;
  quality: ViewQuality;
  setQuality: (quality: ViewQuality) => void;
  retry: () => void;
}

function spatialLayerFor(quality: ViewQuality): number {
  return VIEW_QUALITIES.find((q) => q.id === quality)?.spatialLayer ?? 2;
}

/** Recebe a transmissão de tela de outra pessoa e a entrega como MediaStream para um <video> */
export function useScreenView(media: RoomMedia | null, producerId: string | null): ScreenView {
  const [state, setState] = useState<ScreenViewState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const quality = usePreferencesStore((s) => s.viewQuality);
  const saveQuality = usePreferencesStore((s) => s.setViewQuality);

  useEffect(() => {
    if (!media || !producerId) {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    let consumer: types.Consumer | null = null;
    let transport: types.Transport | null = null;

    const onConnectionChange = (connectionState: string) => {
      if (connectionState === 'failed' && !cancelled) {
        media.session.resetRecvTransport();
        setState({
          status: 'error',
          message: 'Não foi possível receber a transmissão. Uma rede ou firewall pode estar bloqueando a mídia.',
        });
      }
    };

    setState({ status: 'connecting' });

    (async () => {
      transport = await media.session.getRecvTransport();
      transport.on('connectionstatechange', onConnectionChange);

      const { consumer: created, simulcast } = await media.session.consume(producerId);
      if (cancelled) {
        created.close();
        return;
      }
      consumer = created;

      // Aplica a preferência salva; "Automática" é o padrão do servidor e não precisa de pedido
      const preferred = usePreferencesStore.getState().viewQuality;
      if (simulcast && preferred !== 'auto') {
        await media.signaling.setPreferredLayers(created.id, spatialLayerFor(preferred)).catch(() => undefined);
      }

      setState({ status: 'playing', stream: new MediaStream([created.track]), consumerId: created.id, simulcast });
    })().catch((error: unknown) => {
      // Se a transmissão terminou enquanto conectávamos, o efeito já foi cancelado e o erro não importa
      if (cancelled) return;
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível receber a transmissão.',
      });
    });

    return () => {
      cancelled = true;
      transport?.off('connectionstatechange', onConnectionChange);
      consumer?.close();
    };
  }, [media, producerId, attempt]);

  const setQuality = useCallback(
    (next: ViewQuality) => {
      saveQuality(next);
      if (state.status !== 'playing' || !state.simulcast || !media) return;

      media.signaling
        .setPreferredLayers(state.consumerId, spatialLayerFor(next))
        .catch(() => toast('error', 'Não foi possível trocar a qualidade'));
    },
    [media, saveQuality, state],
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, quality, setQuality, retry };
}