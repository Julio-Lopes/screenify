import { z } from 'zod';
import { ROOM_CODE_REGEX } from '../utils/room-code.js';

export const roomCodeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ROOM_CODE_REGEX, 'Código de sala inválido'),
});

export const roomPasswordSchema = z
  .string()
  .min(4, 'A senha deve ter pelo menos 4 caracteres')
  .max(64, 'A senha pode ter no máximo 64 caracteres')
  .regex(/^[^\p{C}]+$/u, 'A senha contém caracteres inválidos');

export const roomNameSchema = z
  .string()
  .trim()
  .min(1, 'O nome da sala não pode ficar vazio')
  .max(60, 'O nome da sala pode ter no máximo 60 caracteres')
  .regex(/^[^\p{C}]+$/u, 'O nome da sala contém caracteres inválidos');

export const createRoomSchema = z.object({
  name: roomNameSchema.optional(),
  password: roomPasswordSchema.optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;