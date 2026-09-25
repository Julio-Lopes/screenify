import { z } from 'zod';
import { ROOM_CODE_REGEX } from '../utils/room-code.js';

export const roomCodeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ROOM_CODE_REGEX, 'Código de sala inválido'),
});