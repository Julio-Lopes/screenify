import type { ProducerInfo, QualityTarget, VideoQuality } from '@screenify/shared';
import { useEffect, useState } from 'react';
import type { RoomMedia } from './useMediaSession';
import type { AppSocket } from '../services/socket';

/** Quem está transmitindo o quê na sala, sempre atualizado pelos eventos do servidor */
export function useRoomProducers(socket: AppSocket, media: RoomMedia | null): ProducerInfo[] {
  const [producers, setProducers] = useState<ProducerInfo[]>([]);

  useEffect(() => {
    if (!media) return;
    let active = true;

    const onAdded = (producer: ProducerInfo) =>
      setProducers((list) => [...list.filter((p) => p.producerId !== producer.producerId), producer]);
    const onClosed = ({ producerId }: { producerId: string }) =>
      setProducers((list) => list.filter((p) => p.producerId !== producerId));

    const onQuality = (update: { producerId: string; quality: VideoQuality; target: QualityTarget }) =>
      setProducers((list) =>
        list.map((p) =>
          p.producerId === update.producerId ? { ...p, quality: update.quality, target: update.target } : p,
        ),
      );

    socket.on('media:producer-added', onAdded);
    socket.on('media:producer-closed', onClosed);
    socket.on('media:producer-quality', onQuality);

    // Estado inicial: o que já estava sendo transmitido antes de entrarmos
    media.signaling
      .listProducers()
      .then((list) => active && setProducers(list))
      .catch(() => active && setProducers([]));

    return () => {
      active = false;
      socket.off('media:producer-added', onAdded);
      socket.off('media:producer-closed', onClosed);
      socket.off('media:producer-quality', onQuality);
    };
  }, [socket, media]);

  return producers;
}