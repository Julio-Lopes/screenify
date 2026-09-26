import type { Participant, Stroke } from '@screenify/shared';
import { useCallback, useEffect, useState } from 'react';

export interface StrokeStyle {
  color: string;
  /** Espessura em pixels numa tela de 1080 de altura */
  width: number;
  opacity: number;
}

export interface Annotations {
  strokes: Stroke[];
  enabled: boolean;
  toggle: () => void;
  userId: string;
  style: StrokeStyle;
  addStroke: (stroke: Stroke) => void;
}

const DEFAULT_WIDTH = 4;

/**
 * Anotações sobre a transmissão atual. Por enquanto só locais: a sincronização entre
 * participantes é a Fase 12. Quando a transmissão muda (resetKey), os desenhos somem,
 * porque eles marcam uma tela que não está mais ali.
 */
export function useAnnotations(self: Participant, resetKey: string | null): Annotations {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setStrokes([]);
    setEnabled(false);
  }, [resetKey]);

  // Esc sai do modo de desenho, como no design system
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEnabled(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((value) => !value), []);
  const addStroke = useCallback((stroke: Stroke) => setStrokes((list) => [...list, stroke]), []);

  return {
    strokes,
    enabled,
    toggle,
    userId: self.userId,
    // Cada pessoa desenha na própria cor, a mesma do avatar
    style: { color: self.color, width: DEFAULT_WIDTH, opacity: 1 },
    addStroke,
  };
}