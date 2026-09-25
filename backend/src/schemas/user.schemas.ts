import { z } from 'zod';

export const createGuestSchema = z.object({
  displayName: z
    .string({ error: 'O nome é obrigatório' })
    .trim()
    .min(1, 'O nome não pode ficar vazio')
    .max(40, 'O nome pode ter no máximo 40 caracteres')
    .regex(/^[^\p{C}]+$/u, 'O nome contém caracteres inválidos'),
});

export type CreateGuestInput = z.infer<typeof createGuestSchema>;