import type { types } from 'mediasoup-client';
import { useCallback, useEffect, useState } from 'react';
import type { RoomMedia } from './useMediaSession';

export type ScreenViewState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'playing'; stream: MediaStream }
  | { status: 'error'; message: string };

/** Recebe a transmissão de tela de outra pessoa e a entrega como MediaStream para um <video> */
export function useScreenView(
  media: RoomMedia | null,
  producerId: string | null,
): { state: ScreenViewState; retry: () => void } {
  const [state, setState] = useState<ScreenViewState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

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

      const created = await media.session.consume(producerId);
      if (cancelled) {
        created.close();
        return;
      }
      consumer = created;
      setState({ status: 'playing', stream: new MediaStream([created.track]) });
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

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, retry };
}