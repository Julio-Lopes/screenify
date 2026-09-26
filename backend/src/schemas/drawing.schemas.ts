import { z } from 'zod';

/** Limites de uma mensagem: protegem o servidor e a sala de traços absurdos */
export const DRAWING_LIMITS = {
  pointsPerMessage: 200,
  pointsPerStroke: 5000,
} as const;

const coordinate = z.number().min(0).max(1);
const point = z.object({ x: coordinate, y: coordinate });

export const startStrokeSchema = z.object({
  id: z.uuid(),
  tool: z.literal('pen'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().min(1).max(64),
  opacity: z.number().min(0.05).max(1),
  points: z.array(point).min(1).max(DRAWING_LIMITS.pointsPerMessage),
});

export const appendStrokeSchema = z.object({
  id: z.uuid(),
  points: z.array(point).min(1).max(DRAWING_LIMITS.pointsPerMessage),
});

export const endStrokeSchema = z.object({
  id: z.uuid(),
});