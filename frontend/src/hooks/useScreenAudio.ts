import type { ProducerInfo } from '@screenify/shared';
import type { types } from 'mediasoup-client';
import { useEffect, useState } from 'react';
import type { RoomMedia } from './useMediaSession';

/**
 * Recebe o áudio da transmissão de tela. Fica separado do useScreenView para o som
 * não reconectar quando o vídeo é republicado (troca de modo).
 */
export function useScreenAudio(media: RoomMedia | null, producer: ProducerInfo | null): MediaStream | null {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const producerId = producer?.producerId ?? null;

  useEffect(() => {
    if (!media || !producerId) {
      setStream(null);
      return;
    }

    let cancelled = false;
    let consumer: types.Consumer | null = null;

    media.session
      .consume(producerId)
      .then(({ consumer: created }) => {
        if (cancelled) {
          created.close();
          return;
        }
        consumer = created;
        setStream(new MediaStream([created.track]));
      })
      .catch(() => {
        // Sem áudio a tela continua: o vídeo tem seu próprio tratamento de erro
        if (!cancelled) setStream(null);
      });

    return () => {
      cancelled = true;
      consumer?.close();
      setStream(null);
    };
  }, [media, producerId]);

  return stream;
}
