import type { CursorPosition, Participant } from '@screenify/shared';
import { useEffect, useState, type RefObject } from 'react';
import { toNormalized } from '../annotation/geometry';
import { useVideoContentRect } from '../annotation/useVideoContentRect';
import type { AppSocket } from '../services/socket';
import { throttle } from './throttle';

export interface CursorContext {
  socket: AppSocket;
  participants: Participant[];
  selfId: string;
  /** Mostrar os cursores das outras pessoas; o seu continua sendo enviado de qualquer jeito */
  visible: boolean;
  toggle: () => void;
  /** Quem está desenhando agora, para o rótulo "desenhando" */
  isDrawing: (userId: string) => boolean;
}

interface CursorLayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  cursors: CursorContext;
}

/** No máximo 20 posições por segundo: o prompt pede throttle, nunca milhares de eventos */
const SEND_INTERVAL_MS = 50;
/** Cursor parado por mais tempo que isso some: a pessoa provavelmente foi fazer outra coisa */
const IDLE_TIMEOUT_MS = 5000;

interface RemoteCursor extends CursorPosition {
  seenAt: number;
}

/**
 * Cursores das outras pessoas sobre a tela compartilhada, e o envio do seu.
 * São elementos HTML sobre a imagem, não desenhos no canvas: o navegador anima
 * a posição com CSS e o texto do nome fica nítido em qualquer zoom.
 */
export function CursorLayer({ videoRef, cursors }: CursorLayerProps) {
  const { socket, participants, selfId, visible, isDrawing } = cursors;
  const rect = useVideoContentRect(videoRef);
  const [remote, setRemote] = useState<ReadonlyMap<string, RemoteCursor>>(new Map());

  // Envia a própria posição enquanto o ponteiro está sobre a imagem
  useEffect(() => {
    const container = videoRef.current?.parentElement;
    if (!container || !rect) return;

    let inside = false;
    const send = throttle((point: { x: number; y: number }) => socket.emit('cursor:move', point), SEND_INTERVAL_MS);
    const leave = () => {
      if (!inside) return;
      inside = false;
      send.cancel();
      socket.emit('cursor:leave');
    };

    const onMove = (event: PointerEvent) => {
      const box = container.getBoundingClientRect();
      const bounds = { left: box.left + rect.x, top: box.top + rect.y, width: rect.width, height: rect.height };
      const outside =
        event.clientX < bounds.left ||
        event.clientX > bounds.left + bounds.width ||
        event.clientY < bounds.top ||
        event.clientY > bounds.top + bounds.height;

      if (outside) {
        leave();
        return;
      }
      inside = true;
      send(toNormalized(event.clientX, event.clientY, bounds));
    };

    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', leave);
    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', leave);
      leave();
    };
  }, [videoRef, rect, socket]);

  // Recebe os cursores das outras pessoas
  useEffect(() => {
    if (!visible) {
      setRemote(new Map());
      return;
    }

    const onMoved = (position: CursorPosition) =>
      setRemote((current) => new Map(current).set(position.userId, { ...position, seenAt: Date.now() }));
    const onLeft = ({ userId }: { userId: string }) =>
      setRemote((current) => {
        if (!current.has(userId)) return current;
        const next = new Map(current);
        next.delete(userId);
        return next;
      });

    // Cursores parados há muito tempo somem
    const prune = setInterval(() => {
      const now = Date.now();
      setRemote((current) => {
        const stale = [...current.values()].filter((c) => now - c.seenAt > IDLE_TIMEOUT_MS);
        if (stale.length === 0) return current;
        const next = new Map(current);
        for (const cursor of stale) next.delete(cursor.userId);
        return next;
      });
    }, 1000);

    socket.on('cursor:moved', onMoved);
    socket.on('cursor:left', onLeft);
    return () => {
      clearInterval(prune);
      socket.off('cursor:moved', onMoved);
      socket.off('cursor:left', onLeft);
    };
  }, [socket, visible]);

  if (!rect || !visible) return null;

  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      aria-hidden
    >
      {[...remote.values()].map((cursor) => {
        // Só aparece quem ainda está na sala: quem saiu some mesmo sem ter mandado "cursor:left"
        const participant = participants.find((p) => p.userId === cursor.userId);
        if (!participant || participant.userId === selfId) return null;

        return (
          <div
            key={cursor.userId}
            className="absolute top-0 left-0 transition-transform duration-75 ease-linear will-change-transform"
            style={{ transform: `translate(${cursor.x * rect.width}px, ${cursor.y * rect.height}px)` }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow" aria-hidden>
              <path
                d="M2 1.5 L15.5 8.2 L9.4 9.6 L6.6 15.8 Z"
                fill={participant.color}
                stroke="#09090B"
                strokeWidth="1.25"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute top-4 left-3.5 rounded-full px-2 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap text-background shadow-sm"
              style={{ backgroundColor: participant.color }}
            >
              {participant.displayName}
              {isDrawing(participant.userId) && <span className="font-normal opacity-80"> · desenhando</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}