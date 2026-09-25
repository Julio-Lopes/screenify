import type { Participant, RoomSummary, SocketAuthErrorMessage } from '@screenify/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSocket, type AppSocket } from '../services/socket';
import { useSessionStore } from '../stores/session.store';

const AUTH_ERROR: SocketAuthErrorMessage = 'UNAUTHORIZED';

export type ConnectionState =
  | { status: 'connecting' }
  | { status: 'password'; error: string | null }
  | {
      status: 'joined';
      room: RoomSummary;
      self: Participant;
      participants: Participant[];
      reconnecting: boolean;
    }
  | { status: 'ended'; reason: 'closed' | 'replaced' | 'not-found' }
  | { status: 'error'; message: string };

interface RoomConnection {
  state: ConnectionState;
  submitPassword: (password: string) => void;
  reconnect: () => void;
}

export function useRoomConnection(code: string, token: string, initialPassword?: string): RoomConnection {
  const [state, setState] = useState<ConnectionState>({ status: 'connecting' });
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<AppSocket | null>(null);
  const passwordRef = useRef(initialPassword);
  const clearSession = useSessionStore((s) => s.clearSession);

  const join = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    socket.emit('room:join', { code, password: passwordRef.current }, (result) => {
      if (result.ok) {
        setState({
          status: 'joined',
          room: result.room,
          self: result.self,
          participants: result.participants,
          reconnecting: false,
        });
        return;
      }

      switch (result.error) {
        case 'PASSWORD_REQUIRED':
          setState({ status: 'password', error: null });
          break;
        case 'WRONG_PASSWORD':
        case 'TOO_MANY_ATTEMPTS':
          setState({ status: 'password', error: result.message });
          break;
        case 'ROOM_NOT_FOUND':
          socket.disconnect();
          setState({ status: 'ended', reason: 'not-found' });
          break;
        default:
          setState({ status: 'error', message: result.message });
      }
    });
  }, [code]);

  useEffect(() => {
    const socket = createSocket(token);
    socketRef.current = socket;
    setState({ status: 'connecting' });

    // Dispara na primeira conexão e em toda reconexão automática: volta para a sala sozinho
    socket.on('connect', join);

    socket.on('connect_error', (error) => {
      if (error.message === AUTH_ERROR) {
        // Sessão não existe mais no servidor: a página volta a pedir o nome
        socket.disconnect();
        clearSession();
        return;
      }

      if (!socket.active) {
        // O servidor recusou a conexão e o Socket.IO não vai tentar de novo sozinho
        setState({ status: 'error', message: 'Não foi possível conectar ao servidor.' });
        return;
      }

      // Falha de rede: o Socket.IO continua tentando em segundo plano
      setState((prev) => (prev.status === 'joined' ? { ...prev, reconnecting: true } : prev));
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      setState((prev) => (prev.status === 'joined' ? { ...prev, reconnecting: true } : prev));
    });

    socket.on('room:participant-joined', (participant) => {
      setState((prev) =>
        prev.status === 'joined'
          ? {
              ...prev,
              participants: [...prev.participants.filter((p) => p.userId !== participant.userId), participant],
            }
          : prev,
      );
    });

    socket.on('room:participant-left', ({ userId }) => {
      setState((prev) =>
        prev.status === 'joined'
          ? { ...prev, participants: prev.participants.filter((p) => p.userId !== userId) }
          : prev,
      );
    });

    socket.on('room:closed', () => {
      socket.disconnect();
      setState({ status: 'ended', reason: 'closed' });
    });

    socket.on('room:session-replaced', () => {
      socket.disconnect();
      setState({ status: 'ended', reason: 'replaced' });
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, join, clearSession, attempt]);

  const submitPassword = useCallback(
    (password: string) => {
      passwordRef.current = password;
      setState({ status: 'connecting' });
      join();
    },
    [join],
  );

  const reconnect = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, submitPassword, reconnect };
}