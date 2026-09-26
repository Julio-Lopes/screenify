import type { Stroke } from '@screenify/shared';
import { REFERENCE_HEIGHT } from './geometry';

interface Size {
  width: number;
  height: number;
}

/** Espessura exibida: proporcional à altura da imagem na tela de quem está vendo */
export function displayWidth(stroke: Stroke, size: Size): number {
  return Math.max(1, (stroke.width * size.height) / REFERENCE_HEIGHT);
}

/**
 * Desenha um traço suavizado. Em vez de ligar os pontos com retas (que deixam o traço serrilhado),
 * passa uma curva pelos pontos médios entre cada par, usando os pontos capturados como controle.
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, size: Size): void {
  const points = stroke.points.map((p) => ({ x: p.x * size.width, y: p.y * size.height }));
  const first = points[0];
  if (!first) return;

  const lineWidth = displayWidth(stroke, size);
  ctx.save();
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Um clique sem arrastar vira um ponto
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(first.x, first.y, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
  ctx.restore();
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