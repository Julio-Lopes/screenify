import type { ProducerInfo } from '@screenify/shared';
import type { types } from 'mediasoup-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  actualLayerHeight,
  layerForMaxHeight,
  layerOptions,
  type LayerOption,
  type SpatialLayer,
} from '../media/quality-presets';
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
  /** Altura que a camada escolhida tem de verdade agora; se chegar menos, a conexão está limitando */
  expectedHeight: number | null;
  setLayer: (layer: SpatialLayer) => void;
  retry: () => void;
  getStats: () => Promise<RTCStatsReport> | null;
}

/** Recebe a transmissão de tela de outra pessoa e a entrega como MediaStream para um <video> */
export function useScreenView(media: RoomMedia | null, producer: ProducerInfo | null): ScreenView {
  const [state, setState] = useState<ScreenViewState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const consumerRef = useRef<types.Consumer | null>(null);
  const preferredHeight = usePreferencesStore((s) => s.viewMaxHeight);
  const savePreferredHeight = usePreferencesStore((s) => s.setViewMaxHeight);

  const producerId = producer?.producerId ?? null;
  // O menu é nomeado pela qualidade escolhida por quem transmite, que é estável;
  // a captura real pode oscilar (ao compartilhar uma aba, o Chrome ajusta a resolução sozinho)
  const menuHeight = producer?.target?.height ?? producer?.quality?.height ?? null;
  const capturedHeight = producer?.quality?.height ?? null;

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
      consumerRef.current = created;
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
      consumerRef.current = null;
    };
  }, [media, producerId, attempt]);

  const simulcast = state.status === 'playing' && state.simulcast;
  const layers = useMemo(() => (simulcast && menuHeight ? layerOptions(menuHeight) : []), [simulcast, menuHeight]);
  const selectedLayer = layerForMaxHeight(preferredHeight, layers);
  const expectedHeight = capturedHeight ? actualLayerHeight(capturedHeight, selectedLayer) : null;
  const consumerId = state.status === 'playing' ? state.consumerId : null;

  // Envia o teto ao servidor quando a transmissão começa e sempre que ele muda:
  // por escolha de quem assiste, ou porque a live mudou de resolução e a camada escolhida deixou de existir
  useEffect(() => {
    if (!media || !consumerId || !simulcast) return;
    void media.signaling.setPreferredLayers(consumerId, selectedLayer).catch(() => undefined);
  }, [media, consumerId, simulcast, selectedLayer]);

  // Guarda a resolução (720), não a posição no menu: se a live mudar de qualidade, 720p continua 720p
  const setLayer = useCallback(
    (layer: SpatialLayer) => {
      const option = layers.find((entry) => entry.layer === layer);
      if (option) savePreferredHeight(option.height);
    },
    [layers, savePreferredHeight],
  );
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const getStats = useCallback(() => consumerRef.current?.getStats() ?? null, []);

  return { state, layers, selectedLayer, expectedHeight, setLayer, retry, getStats };
}