import type { Point, Stroke } from '@screenify/shared';
import { displayWidth, textFontSize } from './tools';

interface Size {
  width: number;
  height: number;
}

interface PixelPoint {
  x: number;
  y: number;
}

/** Menor distância de um ponto a um segmento de reta */
export function distanceToSegment(p: PixelPoint, a: PixelPoint, b: PixelPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToPolyline(p: PixelPoint, points: PixelPoint[], closed = false): number {
  const first = points[0];
  if (!first) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - first.x, p.y - first.y);

  let min = Infinity;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a && b) min = Math.min(min, distanceToSegment(p, a, b));
  }
  return min;
}

/** Contorno da elipse aproximado por 48 segmentos: preciso o bastante para uma borracha */
function ellipseOutline(from: PixelPoint, to: PixelPoint): PixelPoint[] {
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2;
  const rx = Math.abs(to.x - from.x) / 2;
  const ry = Math.abs(to.y - from.y) / 2;
  return Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

/**
 * A borracha encosta neste traço? Mede a distância do ponteiro até o desenho em pixels
 * da tela de quem apaga, somando metade da espessura do traço e o raio da borracha.
 */
export function hitStroke(stroke: Stroke, point: Point, size: Size, radiusPx: number): boolean {
  const p = { x: point.x * size.width, y: point.y * size.height };
  const points = stroke.points.map((q) => ({ x: q.x * size.width, y: q.y * size.height }));
  const first = points[0];
  if (!first) return false;
  const last = points.at(-1) ?? first;
  const tolerance = radiusPx + displayWidth(stroke, size) / 2;

  switch (stroke.tool) {
    case 'pen':
    case 'highlighter':
      return distanceToPolyline(p, points) <= tolerance;
    case 'line':
    case 'arrow':
      return distanceToSegment(p, first, last) <= tolerance;
    case 'rect': {
      const corners = [first, { x: last.x, y: first.y }, last, { x: first.x, y: last.y }];
      return distanceToPolyline(p, corners, true) <= tolerance;
    }
    case 'circle':
      return distanceToPolyline(p, ellipseOutline(first, last), true) <= tolerance;
    case 'text': {
      // Largura estimada pelo número de letras: evita depender de um canvas para medir
      const fontSize = textFontSize(stroke, size);
      const width = (stroke.text?.length ?? 0) * fontSize * 0.55;
      const height = fontSize * 1.2;
      return (
        p.x >= first.x - radiusPx &&
        p.x <= first.x + width + radiusPx &&
        p.y >= first.y - radiusPx &&
        p.y <= first.y + height + radiusPx
      );
    }
  }
}