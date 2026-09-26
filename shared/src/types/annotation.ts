/**
 * Ponto normalizado: x e y vão de 0 a 1 em relação à imagem da tela compartilhada,
 * não aos pixels de quem desenha. Assim o traço cai no mesmo lugar em 1080p, 720p ou 360p.
 */
export interface Point {
  x: number;
  y: number;
}

/** Ferramentas disponíveis. A lista completa do prompt chega na fase de ferramentas */
export type StrokeTool = 'pen';

export interface Stroke {
  id: string;
  userId: string;
  tool: StrokeTool;
  color: string;
  /** Espessura em pixels numa tela de 1080 de altura; é escalada para o tamanho exibido */
  width: number;
  /** De 0 a 1 */
  opacity: number;
  points: Point[];
}