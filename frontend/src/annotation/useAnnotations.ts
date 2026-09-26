import type { AppendStrokePayload, Participant, Point, RemoveStrokesPayload, RestoreStrokesPayload, Stroke } from '@screenify/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSocket } from '../services/socket';
import { StrokeSender } from './stroke-sender';
import type { ToolId } from './tools';

export interface StrokeStyle {
  color: string;
  /** Espessura em pixels numa tela de 1080 de altura */
  width: number;
  opacity: number;
}

/** O que desfazer e refazer podem reverter: um traço criado ou traços removidos */
type HistoryAction = { type: 'add'; stroke: Stroke } | { type: 'remove'; strokes: Stroke[] };

const MAX_HISTORY = 100;

export interface Annotations {
  /** Traços concluídos, de todo mundo */
  strokes: Stroke[];
  /** Traços que outras pessoas estão desenhando agora (lidos a cada quadro, fora do estado do React) */
  getRemoteActive: () => Stroke[];
  /** Avisa quando os traços remotos em andamento mudam, para a camada redesenhar */
  subscribeRemote: (listener: () => void) => () => void;
  userId: string;
  tool: ToolId;
  setTool: (tool: ToolId) => void;
  style: StrokeStyle;
  setStyle: (style: Partial<StrokeStyle>) => void;
  /** Cor da pessoa na sala: é a primeira opção da paleta */
  ownColor: string;
  beginStroke: (stroke: Stroke) => void;
  extendStroke: (id: string, points: Point[], mode?: 'append' | 'latest') => void;
  finishStroke: (stroke: Stroke) => void;
  /** A borracha só alcança o que a pessoa tem permissão de apagar */
  canErase: (stroke: Stroke) => boolean;
  erase: (strokes: Stroke[]) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Quem criou a sala limpa tudo; os outros, só os próprios traços */
  isHost: boolean;
}

const DEFAULT_WIDTH = 4;

/**
 * Anotações da sala sobre a transmissão atual, sincronizadas pelo Socket.IO, com as ferramentas,
 * o estilo escolhido e o histórico de desfazer/refazer de quem está desenhando.
 * Quando a transmissão muda (surfaceKey), tudo recomeça: os desenhos marcavam outra tela.
 */
export function useAnnotations(self: Participant, socket: AppSocket, surfaceKey: string | null): Annotations {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<ToolId>('select');
  const [style, setStyleState] = useState<StrokeStyle>({ color: self.color, width: DEFAULT_WIDTH, opacity: 1 });
  const [history, setHistory] = useState<{ undo: HistoryAction[]; redo: HistoryAction[] }>({ undo: [], redo: [] });
  const remoteActiveRef = useRef(new Map<string, Stroke>());
  const listenersRef = useRef(new Set<() => void>());
  const senderRef = useRef<StrokeSender | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;

  const isHost = self.role === 'HOST';

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
    setTool('select');
    setHistory({ undo: [], redo: [] });
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
    const onRemoved = ({ ids }: RemoveStrokesPayload) => {
      const removed = new Set(ids);
      setStrokes((list) => list.filter((s) => !removed.has(s.id)));
    };
    const onRestored = ({ strokes: restored }: RestoreStrokesPayload) => {
      setStrokes((list) => {
        const existing = new Set(list.map((s) => s.id));
        return [...list, ...restored.filter((s) => !existing.has(s.id))];
      });
    };

    socket.on('drawing:started', onStarted);
    socket.on('drawing:appended', onAppended);
    socket.on('drawing:ended', onEnded);
    socket.on('drawing:cleared', onCleared);
    socket.on('drawing:removed', onRemoved);
    socket.on('drawing:restored', onRestored);

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
      socket.off('drawing:removed', onRemoved);
      socket.off('drawing:restored', onRestored);
    };
  }, [socket, surfaceKey, notifyRemote]);

  const pushHistory = useCallback((action: HistoryAction) => {
    setHistory(({ undo }) => ({ undo: [...undo, action].slice(-MAX_HISTORY), redo: [] }));
  }, []);

  /** Tira traços da tela e avisa a sala */
  const removeStrokes = useCallback((toRemove: Stroke[]) => {
    const ids = new Set(toRemove.map((s) => s.id));
    setStrokes((list) => list.filter((s) => !ids.has(s.id)));
    senderRef.current?.remove([...ids]);
  }, []);

  /** Devolve traços à tela e avisa a sala */
  const restoreStrokes = useCallback((toRestore: Stroke[]) => {
    setStrokes((list) => {
      const existing = new Set(list.map((s) => s.id));
      return [...list, ...toRestore.filter((s) => !existing.has(s.id))];
    });
    senderRef.current?.restore(toRestore);
  }, []);

  const getRemoteActive = useCallback(() => [...remoteActiveRef.current.values()], []);
  const subscribeRemote = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const setStyle = useCallback((next: Partial<StrokeStyle>) => setStyleState((current) => ({ ...current, ...next })), []);

  const beginStroke = useCallback((stroke: Stroke) => senderRef.current?.start(stroke), []);
  const extendStroke = useCallback(
    (id: string, points: Point[], mode?: 'append' | 'latest') => senderRef.current?.add(id, points, mode),
    [],
  );
  const finishStroke = useCallback(
    (stroke: Stroke) => {
      senderRef.current?.end(stroke.id);
      // O próprio traço entra na lista na hora, sem esperar ida e volta ao servidor
      setStrokes((list) => [...list, stroke]);
      pushHistory({ type: 'add', stroke });
    },
    [pushHistory],
  );

  const canErase = useCallback((stroke: Stroke) => isHost || stroke.userId === self.userId, [isHost, self.userId]);

  const erase = useCallback(
    (toErase: Stroke[]) => {
      const allowed = toErase.filter(canErase);
      if (allowed.length === 0) return;
      removeStrokes(allowed);
      pushHistory({ type: 'remove', strokes: allowed });
    },
    [canErase, removeStrokes, pushHistory],
  );

  const clear = useCallback(() => erase(strokesRef.current), [erase]);

  const undo = useCallback(() => {
    const action = history.undo.at(-1);
    if (!action) return;
    if (action.type === 'add') removeStrokes([action.stroke]);
    else restoreStrokes(action.strokes);
    setHistory(({ undo: list, redo }) => ({ undo: list.slice(0, -1), redo: [...redo, action] }));
  }, [history.undo, removeStrokes, restoreStrokes]);

  const redo = useCallback(() => {
    const action = history.redo.at(-1);
    if (!action) return;
    if (action.type === 'add') restoreStrokes([action.stroke]);
    else removeStrokes(action.strokes);
    setHistory(({ undo: list, redo }) => ({ undo: [...list, action], redo: redo.slice(0, -1) }));
  }, [history.redo, removeStrokes, restoreStrokes]);

  return {
    strokes,
    getRemoteActive,
    subscribeRemote,
    userId: self.userId,
    tool,
    setTool,
    style,
    setStyle,
    ownColor: self.color,
    beginStroke,
    extendStroke,
    finishStroke,
    canErase,
    erase,
    clear,
    undo,
    redo,
    canUndo: history.undo.length > 0,
    canRedo: history.redo.length > 0,
    isHost,
  };
}