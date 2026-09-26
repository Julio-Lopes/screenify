import type { Point } from './annotation.js';

/** Posição do cursor de alguém sobre a tela compartilhada, em coordenadas normalizadas */
export interface CursorPosition extends Point {
  userId: string;
}