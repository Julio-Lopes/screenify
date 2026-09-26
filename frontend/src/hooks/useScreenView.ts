import type { ProducerInfo } from '@screenify/shared';
import type { types } from 'mediasoup-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { effectiveLayer, layerOptions, type LayerOption, type SpatialLayer } from '../media/quality-presets';
import { usePreferencesStore } from '../stores/preferences.store';
import type { RoomMedia } from './useMediaSession';

export type ScreenViewState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'playing'; stream: MediaStream; consumerId: string; simulcast: boolean }
  | { status: 'error'; message: string };

interface ScreenView {
  state: ScreenViewState;
  /** Resoluções que existem na live agora, da maior para a menor (vazio sem simulcast) */
  layers: LayerOption[];
  selectedLayer: SpatialLayer;
  setLayer: (layer: SpatialLayer) => void;
  retry: () => void;
}

/** Recebe a transmissão de tela de outra pessoa e a entrega como MediaStream para um <video> */
export function useScreenView(media: RoomMedia | null, producer: ProducerInfo | null): ScreenView {
  const [state, setState] = useState<ScreenViewState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const preferredLayer = usePreferencesStore((s) => s.viewLayer);
  const savePreferredLayer = usePreferencesStore((s) => s.setViewLayer);

  const producerId = producer?.producerId ?? null;
  const liveHeight = producer?.quality?.height ?? null;

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

  const simulcast = state.status === 'playing' && state.simulcast;
  const layers = useMemo(() => (simulcast && liveHeight ? layerOptions(liveHeight) : []), [simulcast, liveHeight]);
  const selectedLayer = layers.length > 0 ? effectiveLayer(preferredLayer, layers) : preferredLayer;
  const consumerId = state.status === 'playing' ? state.consumerId : null;

  // Envia o teto ao servidor quando a transmissão começa e sempre que ele muda:
  // por escolha de quem assiste, ou porque a live mudou de resolução e a camada escolhida deixou de existir
  useEffect(() => {
    if (!media || !consumerId || !simulcast) return;
    void media.signaling.setPreferredLayers(consumerId, selectedLayer).catch(() => undefined);
  }, [media, consumerId, simulcast, selectedLayer]);

  const setLayer = useCallback((layer: SpatialLayer) => savePreferredLayer(layer), [savePreferredLayer]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, layers, selectedLayer, setLayer, retry };
}