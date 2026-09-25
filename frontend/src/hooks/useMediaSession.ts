import { useEffect, useState } from 'react';
import { MediaSession } from '../media/media-session';
import { MediaSignaling } from '../media/media-signaling';
import type { AppSocket } from '../services/socket';

export interface RoomMedia {
  signaling: MediaSignaling;
  session: MediaSession;
}

/**
 * Uma sessão de mídia por entrada na sala. Depois de uma reconexão o servidor já descartou
 * os transports antigos, então tudo é recriado (joinedAt muda).
 *
 * A sessão nasce dentro do efeito, e não num useMemo: assim cada montagem tem a sua própria,
 * e o cleanup nunca fecha uma sessão que ainda vai ser usada (o StrictMode monta duas vezes).
 */
export function useMediaSession(socket: AppSocket, joinedAt: number): RoomMedia | null {
  const [media, setMedia] = useState<RoomMedia | null>(null);

  useEffect(() => {
    const signaling = new MediaSignaling(socket);
    const session = new MediaSession(signaling);
    setMedia({ signaling, session });

    return () => {
      session.close();
      setMedia(null);
    };
  }, [socket, joinedAt]);

  return media;
}