import type { Stroke } from '@screenify/shared';
import { displayWidth, TEXT_FONT_FAMILY, textFontSize } from './tools';

interface Size {
  width: number;
  height: number;
}

interface PixelPoint {
  x: number;
  y: number;
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, size: Size): void {
  const points = stroke.points.map((p) => ({ x: p.x * size.width, y: p.y * size.height }));
  const first = points[0];
  if (!first) return;
  const last = points.at(-1) ?? first;

  ctx.save();
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = displayWidth(stroke, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (stroke.tool) {
    case 'pen':
    case 'highlighter':
      drawFreehand(ctx, points);
      break;
    case 'line':
      drawLine(ctx, first, last);
      break;
    case 'arrow':
      drawArrow(ctx, first, last);
      break;
    case 'rect':
      ctx.strokeRect(first.x, first.y, last.x - first.x, last.y - first.y);
      break;
    case 'circle':
      drawEllipse(ctx, first, last);
      break;
    case 'text':
      drawText(ctx, stroke, first, size);
      break;
  }
  ctx.restore();
}

/**
 * Traço livre suavizado. Em vez de ligar os pontos com retas (que deixam o traço serrilhado),
 * passa uma curva pelos pontos médios entre cada par, usando os pontos capturados como controle.
 */
function drawFreehand(ctx: CanvasRenderingContext2D, points: PixelPoint[]): void {
  const first = points[0];
  if (!first) return;

  // Um clique sem arrastar vira um ponto
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(first.x, first.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    if (!current || !next) continue;
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = points.at(-1) ?? first;
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function drawLine(ctx: CanvasRenderingContext2D, from: PixelPoint, to: PixelPoint): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

/** Linha com ponta aberta, proporcional à espessura */
function drawArrow(ctx: CanvasRenderingContext2D, from: PixelPoint, to: PixelPoint): void {
  drawLine(ctx, from, to);

  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  // A ponta nunca passa de metade da seta, para setas curtas continuarem legíveis
  const head = Math.min(Math.max(ctx.lineWidth * 4, 10), length / 2);
  const spread = Math.PI / 7;

  ctx.beginPath();
  ctx.moveTo(to.x - head * Math.cos(angle - spread), to.y - head * Math.sin(angle - spread));
  ctx.lineTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle + spread), to.y - head * Math.sin(angle + spread));
  ctx.stroke();
}

/** Elipse inscrita no retângulo do arraste */
function drawEllipse(ctx: CanvasRenderingContext2D, from: PixelPoint, to: PixelPoint): void {
  ctx.beginPath();
  ctx.ellipse(
    (from.x + to.x) / 2,
    (from.y + to.y) / 2,
    Math.abs(to.x - from.x) / 2,
    Math.abs(to.y - from.y) / 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, stroke: Stroke, at: PixelPoint, size: Size): void {
  if (!stroke.text) return;
  ctx.font = `600 ${textFontSize(stroke, size)}px ${TEXT_FONT_FAMILY}`;
  ctx.textBaseline = 'top';
  // Sombra discreta: o texto continua legível sobre fundos claros e escuros
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(stroke.text, at.x, at.y);
}

/** Prepara o canvas para o tamanho exibido, com nitidez em telas de alta densidade (retina, zoom) */
export function fitCanvas(canvas: HTMLCanvasElement, size: Size): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(size.width * ratio);
  const height = Math.round(size.height * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx?.clearRect(0, 0, size.width, size.height);
  return ctx;
}