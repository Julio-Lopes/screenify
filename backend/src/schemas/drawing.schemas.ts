import { z } from 'zod';

/** Limites de uma mensagem: protegem o servidor e a sala de traços absurdos */
export const DRAWING_LIMITS = {
  pointsPerMessage: 200,
  pointsPerStroke: 5000,
  textLength: 200,
  strokesPerMessage: 500,
} as const;

const coordinate = z.number().min(0).max(1);
const point = z.object({ x: coordinate, y: coordinate });

const strokeFields = {
  id: z.uuid(),
  tool: z.enum(['pen', 'highlighter', 'line', 'arrow', 'rect', 'circle', 'text']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().min(1).max(64),
  opacity: z.number().min(0.05).max(1),
  text: z
    .string()
    .trim()
    .min(1)
    .max(DRAWING_LIMITS.textLength)
    .regex(/^[^\p{Cc}]+$/u)
    .optional(),
};

/** Texto exige o campo text; as outras ferramentas não podem ter */
const textMatchesTool = (stroke: { tool: string; text?: string | undefined }) =>
  (stroke.tool === 'text') === (stroke.text !== undefined);

export const startStrokeSchema = z
  .object({
    ...strokeFields,
    points: z.array(point).min(1).max(DRAWING_LIMITS.pointsPerMessage),
  })
  .refine(textMatchesTool, { message: 'Texto inválido para a ferramenta' });

export const appendStrokeSchema = z.object({
  id: z.uuid(),
  points: z.array(point).min(1).max(DRAWING_LIMITS.pointsPerMessage),
});

export const endStrokeSchema = z.object({
  id: z.uuid(),
});

export const removeStrokesSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(DRAWING_LIMITS.strokesPerMessage),
});

export const restoreStrokesSchema = z.object({
  strokes: z
    .array(
      z
        .object({
          ...strokeFields,
          userId: z.uuid(),
          points: z.array(point).min(1).max(DRAWING_LIMITS.pointsPerStroke),
        })
        .refine(textMatchesTool),
    )
    .min(1)
    .max(DRAWING_LIMITS.strokesPerMessage),
});