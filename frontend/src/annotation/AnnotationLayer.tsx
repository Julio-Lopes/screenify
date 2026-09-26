import type { Point, Stroke } from '@screenify/shared';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { cn } from '../utils/cn';
import { pixelDistance, toNormalized, videoContentRect, type Rect } from './geometry';
import { drawStroke, fitCanvas } from './renderer';
import type { Annotations } from './useAnnotations';

interface AnnotationLayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  annotations: Annotations;
}

/** Pontos mais próximos que isso (em px na tela) não mudam o desenho: são descartados */
const MIN_POINT_DISTANCE_PX = 1.5;

/**
 * Camada de desenho sobre o vídeo. São dois canvas empilhados, cobrindo exatamente a área
 * da imagem (sem as faixas pretas): um com os traços prontos, redesenhado só quando eles mudam,
 * e outro com os traços em andamento (o seu e os de quem está desenhando agora),
 * redesenhado a cada movimento sem tocar nos prontos.
 */
export function AnnotationLayer({ videoRef, annotations }: AnnotationLayerProps) {
  const { strokes, enabled, style, userId, beginStroke, extendStroke, finishStroke, getRemoteActive, subscribeRemote } =
    annotations;
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const frameRef = useRef<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  // Acompanha tamanho, proporção e posição da imagem dentro do <video>
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      const next = videoContentRect(video);
      setRect((current) =>
        current &&
        current.x === next.x &&
        current.y === next.y &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(video);
    // A resolução da transmissão muda sem o elemento mudar de tamanho
    video.addEventListener('resize', update);
    video.addEventListener('loadedmetadata', update);

    return () => {
      observer.disconnect();
      video.removeEventListener('resize', update);
      video.removeEventListener('loadedmetadata', update);
    };
  }, [videoRef]);

  // Traços prontos: redesenha tudo quando a lista ou o tamanho muda
  useEffect(() => {
    const canvas = committedRef.current;
    if (!canvas || !rect) return;
    const ctx = fitCanvas(canvas, rect);
    if (!ctx) return;
    for (const stroke of strokes) drawStroke(ctx, stroke, rect);
  }, [strokes, rect]);

  // O canvas do traço em andamento também precisa acompanhar o tamanho
  useEffect(() => {
    if (liveRef.current && rect) fitCanvas(liveRef.current, rect);
  }, [rect]);

  // Canvas de cima: o traço que você está fazendo e os que outras pessoas estão fazendo agora
  const renderLive = useCallback(() => {
    frameRef.current = null;
    const canvas = liveRef.current;
    if (!canvas || !rect) return;
    const ctx = fitCanvas(canvas, rect);
    if (!ctx) return;
    for (const stroke of getRemoteActive()) drawStroke(ctx, stroke, rect);
    if (drawingRef.current) drawStroke(ctx, drawingRef.current, rect);
  }, [rect, getRemoteActive]);

  /** No máximo um redesenho por quadro da tela, por mais eventos que cheguem */
  const scheduleRender = useCallback(() => {
    frameRef.current ??= requestAnimationFrame(renderLive);
  }, [renderLive]);

  // Pontos de outras pessoas chegando pela rede também pedem redesenho
  useEffect(() => subscribeRemote(scheduleRender), [subscribeRemote, scheduleRender]);

  useEffect(
    () => () => {
      // Zerar a ref é essencial: um id antigo deixado aqui faria o ??= acima nunca mais agendar nada
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    },
    [],
  );

  /** Acrescenta o ponto se ele mudar o desenho; devolve se entrou */
  function addPoint(stroke: Stroke, point: Point): boolean {
    const last = stroke.points.at(-1);
    if (last && rect && pixelDistance(last, point, rect) < MIN_POINT_DISTANCE_PX) return false;
    stroke.points.push(point);
    return true;
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!enabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    const bounds = event.currentTarget.getBoundingClientRect();
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      userId,
      tool: 'pen',
      color: style.color,
      width: style.width,
      opacity: style.opacity,
      points: [toNormalized(event.clientX, event.clientY, bounds)],
    };
    drawingRef.current = stroke;
    beginStroke({ ...stroke, points: [...stroke.points] });
    scheduleRender();
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = drawingRef.current;
    if (!stroke) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    // Eventos agrupados pelo navegador entre dois quadros: sem eles, traços rápidos saem quebrados
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const added: Point[] = [];
    for (const e of events) {
      const point = toNormalized(e.clientX, e.clientY, bounds);
      if (addPoint(stroke, point)) added.push(point);
    }
    extendStroke(stroke.id, added);
    scheduleRender();
  }

  function onPointerUp() {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (stroke) finishStroke(stroke);
    scheduleRender();
  }

  if (!rect) return null;

  const position = { left: rect.x, top: rect.y, width: rect.width, height: rect.height };

  return (
    <>
      <canvas ref={committedRef} className="pointer-events-none absolute" style={position} aria-hidden />
      <canvas
        ref={liveRef}
        style={position}
        className={cn('absolute touch-none', enabled ? 'cursor-crosshair' : 'pointer-events-none')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={enabled ? 'Área de anotação: arraste para desenhar sobre a tela' : undefined}
        aria-hidden={!enabled}
      />
    </>
  );
}