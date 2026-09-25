import type { RoomSummary } from '@screenify/shared';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/api';
import { getRoom } from '../services/rooms';
import { isValidRoomCode } from '../utils/room-code';

export type RoomState =
  | { status: 'loading' }
  | { status: 'ready'; room: RoomSummary }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

export function useRoom(code: string): { state: RoomState; retry: () => void } {
  const [state, setState] = useState<RoomState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isValidRoomCode(code)) {
      setState({ status: 'not-found' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    getRoom(code, controller.signal)
      .then((room) => setState({ status: 'ready', room }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (error instanceof ApiError && error.status === 404) {
          setState({ status: 'not-found' });
        } else if (error instanceof ApiError) {
          setState({ status: 'error', message: error.message });
        } else {
          setState({ status: 'error', message: 'Algo deu errado ao carregar a sala.' });
        }
      });

    return () => controller.abort();
  }, [code, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, retry };
}