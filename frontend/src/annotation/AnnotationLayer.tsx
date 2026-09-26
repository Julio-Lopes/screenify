import type { Point, Stroke, StrokeTool } from '@screenify/shared';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { cn } from '../utils/cn';
import { pixelDistance, toNormalized } from './geometry';
import { hitStroke } from './hit-test';
import { drawStroke, fitCanvas } from './renderer';
import { HIGHLIGHTER, isShapeTool, TEXT_FONT_FAMILY, textFontSize } from './tools';
import type { Annotations } from './useAnnotations';
import { useVideoContentRect } from './useVideoContentRect';

interface AnnotationLayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  annotations: Annotations;
}

/** Pontos mais próximos que isso (em px na tela) não mudam o desenho: são descartados */
const MIN_POINT_DISTANCE_PX = 1.5;
/** Raio da borracha, em px na tela de quem apaga */
const ERASER_RADIUS_PX = 8;
const TEXT_MAX_LENGTH = 200;

interface TextDraft {
  point: Point;
  value: string;
}

/**
 * Camada de desenho sobre o vídeo. São dois canvas empilhados, cobrindo exatamente a área
 * da imagem (sem as faixas pretas): um com os traços prontos, redesenhado só quando eles mudam,
 * e outro com os traços em andamento (o seu e os de quem está desenhando agora),
 * redesenhado a cada movimento sem tocar nos prontos.
 */
export function AnnotationLayer({ videoRef, annotations }: AnnotationLayerProps) {
  const { strokes, tool, style, userId, getRemoteActive, subscribeRemote } = annotations;
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const frameRef = useRef<number | null>(null);
  // Tamanho, proporção e posição da imagem dentro do <video>
  const rect = useVideoContentRect(videoRef);
  /** Traços que a borracha já tocou neste arraste: somem na hora, são removidos ao soltar */
  const [erasing, setErasing] = useState<ReadonlyMap<string, Stroke>>(new Map());
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);

  // Trocar de ferramenta abandona um texto que estava sendo digitado
  useEffect(() => {
    if (tool !== 'text') setTextDraft(null);
  }, [tool]);

  // Traços prontos: redesenha tudo quando a lista, o tamanho ou a borracha mudam
  useEffect(() => {
    const canvas = committedRef.current;
    if (!canvas || !rect) return;
    const ctx = fitCanvas(canvas, rect);
    if (!ctx) return;
    for (const stroke of strokes) {
      if (!erasing.has(stroke.id)) drawStroke(ctx, stroke, rect);
    }
  }, [strokes, rect, erasing]);

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

  function newStroke(drawTool: StrokeTool, point: Point, text?: string): Stroke {
    const highlighter = drawTool === 'highlighter';
    return {
      id: crypto.randomUUID(),
      userId,
      tool: drawTool,
      color: style.color,
      width: highlighter ? style.width * HIGHLIGHTER.widthFactor : style.width,
      opacity: highlighter ? style.opacity * HIGHLIGHTER.opacityFactor : style.opacity,
      points: [point],
      ...(text !== undefined && { text }),
    };
  }

  /** A borracha remove, de cima para baixo, os traços que ela encosta e que a pessoa pode apagar */
  function eraseAt(point: Point) {
    if (!rect) return;
    const hits = strokes.filter(
      (stroke) => !erasing.has(stroke.id) && annotations.canErase(stroke) && hitStroke(stroke, point, rect, ERASER_RADIUS_PX),
    );
    if (hits.length === 0) return;
    setErasing((current) => {
      const next = new Map(current);
      for (const stroke of hits) next.set(stroke.id, stroke);
      return next;
    });
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (tool === 'select' || event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = toNormalized(event.clientX, event.clientY, bounds);

    if (tool === 'text') {
      // O clique marca onde o texto começa; ele é enviado ao confirmar com Enter
      event.preventDefault();
      setTextDraft({ point, value: '' });
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === 'eraser') {
      eraseAt(point);
      return;
    }

    const stroke = newStroke(tool, point);
    // Formas começam com dois pontos iguais: o segundo acompanha o arraste
    if (isShapeTool(tool)) stroke.points.push(point);
    drawingRef.current = stroke;
    annotations.beginStroke({ ...stroke, points: [...stroke.points] });
    scheduleRender();
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    if (tool === 'eraser' && event.buttons === 1) {
      eraseAt(toNormalized(event.clientX, event.clientY, bounds));
      return;
    }

    const stroke = drawingRef.current;
    if (!stroke) return;

    if (isShapeTool(stroke.tool)) {
      // Na forma, só importa onde o arraste está agora
      const point = toNormalized(event.clientX, event.clientY, bounds);
      stroke.points[stroke.points.length - 1] = point;
      annotations.extendStroke(stroke.id, [point], 'latest');
      scheduleRender();
      return;
    }

    // Eventos agrupados pelo navegador entre dois quadros: sem eles, traços rápidos saem quebrados
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const added: Point[] = [];
    for (const e of events) {
      const point = toNormalized(e.clientX, e.clientY, bounds);
      if (addPoint(stroke, point)) added.push(point);
    }
    annotations.extendStroke(stroke.id, added);
    scheduleRender();
  }

  function onPointerUp() {
    if (tool === 'eraser') {
      if (erasing.size > 0) annotations.erase([...erasing.values()]);
      setErasing(new Map());
      return;
    }

    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (stroke) annotations.finishStroke(stroke);
    scheduleRender();
  }

  function commitText() {
    const draft = textDraft;
    setTextDraft(null);
    const text = draft?.value.trim();
    if (!draft || !text) return;

    const stroke = newStroke('text', draft.point, text);
    annotations.beginStroke(stroke);
    annotations.finishStroke(stroke);
  }

  function onTextKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter e Esc são do campo de texto: não devem acionar os atalhos da barra
    event.stopPropagation();
    if (event.key === 'Enter') commitText();
    if (event.key === 'Escape') setTextDraft(null);
  }

  if (!rect) return null;

  const position = { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
  const cursor = tool === 'text' ? 'cursor-text' : tool === 'select' ? '' : 'cursor-crosshair';

  return (
    <>
      <canvas ref={committedRef} className="pointer-events-none absolute" style={position} aria-hidden />
      <canvas
        ref={liveRef}
        style={position}
        className={cn('absolute touch-none', tool === 'select' ? 'pointer-events-none' : cursor)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={tool === 'select' ? undefined : 'Área de anotação: desenhe sobre a tela'}
        aria-hidden={tool === 'select'}
      />
      {textDraft && (
        <input
          autoFocus
          value={textDraft.value}
          onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
          onKeyDown={onTextKeyDown}
          onBlur={commitText}
          maxLength={TEXT_MAX_LENGTH}
          aria-label="Texto da anotação"
          placeholder="Digite e aperte Enter"
          className="absolute min-w-40 border-b border-dashed bg-transparent font-semibold outline-none placeholder:text-text-muted"
          style={{
            left: rect.x + textDraft.point.x * rect.width,
            top: rect.y + textDraft.point.y * rect.height,
            color: style.color,
            borderColor: style.color,
            fontFamily: TEXT_FONT_FAMILY,
            fontSize: textFontSize(style, rect),
            lineHeight: 1,
            opacity: style.opacity,
          }}
        />
      )}
    </>
  );
}