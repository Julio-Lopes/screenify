import type { AppendStrokePayload, Participant, Point, Stroke } from '@screenify/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSocket } from '../services/socket';
import { StrokeSender } from './stroke-sender';

export interface StrokeStyle {
  color: string;
  /** Espessura em pixels numa tela de 1080 de altura */
  width: number;
  opacity: number;
}

export interface Annotations {
  /** Traços concluídos, de todo mundo */
  strokes: Stroke[];
  /** Traços que outras pessoas estão desenhando agora (lidos a cada quadro, fora do estado do React) */
  getRemoteActive: () => Stroke[];
  /** Avisa quando os traços remotos em andamento mudam, para a camada redesenhar */
  subscribeRemote: (listener: () => void) => () => void;
  enabled: boolean;
  toggle: () => void;
  userId: string;
  style: StrokeStyle;
  beginStroke: (stroke: Stroke) => void;
  extendStroke: (id: string, points: Point[]) => void;
  finishStroke: (stroke: Stroke) => void;
}

const DEFAULT_WIDTH = 4;

/**
 * Anotações da sala sobre a transmissão atual, sincronizadas pelo Socket.IO.
 * Quando a transmissão muda (surfaceKey), tudo recomeça: os desenhos marcavam outra tela.
 */
export function useAnnotations(self: Participant, socket: AppSocket, surfaceKey: string | null): Annotations {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [enabled, setEnabled] = useState(false);
  const remoteActiveRef = useRef(new Map<string, Stroke>());
  const listenersRef = useRef(new Set<() => void>());
  const senderRef = useRef<StrokeSender | null>(null);

  const notifyRemote = useCallback(() => {
    for (const listener of listenersRef.current) listener();
  }, []);

  useEffect(() => {
    const sender = new StrokeSender(socket);
    senderRef.current = sender;
    return () => {
      sender.dispose();
      senderRef.current = null;
    };
  }, [socket]);

  useEffect(() => {
    const remoteActive = remoteActiveRef.current;
    let active = true;

    setStrokes([]);
    setEnabled(false);
    remoteActive.clear();
    notifyRemote();

    if (!surfaceKey) return;

    const onStarted = (stroke: Stroke) => {
      remoteActive.set(stroke.id, stroke);
      notifyRemote();
    };
    const onAppended = ({ id, points }: AppendStrokePayload) => {
      const stroke = remoteActive.get(id);
      if (!stroke) return;
      stroke.points.push(...points);
      notifyRemote();
    };
    const onEnded = ({ id }: { id: string }) => {
      const stroke = remoteActive.get(id);
      if (!stroke) return;
      remoteActive.delete(id);
      setStrokes((list) => [...list, stroke]);
      notifyRemote();
    };
    const onCleared = () => {
      remoteActive.clear();
      setStrokes([]);
      notifyRemote();
    };

    socket.on('drawing:started', onStarted);
    socket.on('drawing:appended', onAppended);
    socket.on('drawing:ended', onEnded);
    socket.on('drawing:cleared', onCleared);

    // Quem chega com a transmissão em andamento recebe o que já foi desenhado
    socket
      .timeout(5000)
      .emitWithAck('drawing:sync')
      .then((snapshot) => {
        if (!active) return;
        setStrokes(snapshot.strokes);
        for (const stroke of snapshot.active) remoteActive.set(stroke.id, stroke);
        notifyRemote();
      })
      .catch(() => undefined);

    return () => {
      active = false;
      socket.off('drawing:started', onStarted);
      socket.off('drawing:appended', onAppended);
      socket.off('drawing:ended', onEnded);
      socket.off('drawing:cleared', onCleared);
    };
  }, [socket, surfaceKey, notifyRemote]);

  // Esc sai do modo de desenho, como no design system
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEnabled(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  const getRemoteActive = useCallback(() => [...remoteActiveRef.current.values()], []);
  const subscribeRemote = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const toggle = useCallback(() => setEnabled((value) => !value), []);
  const beginStroke = useCallback((stroke: Stroke) => senderRef.current?.start(stroke), []);
  const extendStroke = useCallback((id: string, points: Point[]) => senderRef.current?.add(id, points), []);
  const finishStroke = useCallback((stroke: Stroke) => {
    senderRef.current?.end(stroke.id);
    // O próprio traço entra na lista na hora, sem esperar ida e volta ao servidor
    setStrokes((list) => [...list, stroke]);
  }, []);

  return {
    strokes,
    getRemoteActive,
    subscribeRemote,
    enabled,
    toggle,
    userId: self.userId,
    // Cada pessoa desenha na própria cor, a mesma do avatar
    style: { color: self.color, width: DEFAULT_WIDTH, opacity: 1 },
    beginStroke,
    extendStroke,
    finishStroke,
  };
}