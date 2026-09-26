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

/** Começo de um traço: o servidor completa com o userId de quem desenhou */
export type StartStrokePayload = Omit<Stroke, 'userId'>;

export interface AppendStrokePayload {
  id: string;
  points: Point[];
}

/** Estado das anotações para quem entra com desenhos já feitos */
export interface AnnotationSnapshot {
  /** Traços concluídos, na ordem em que terminaram */
  strokes: Stroke[];
  /** Traços que alguém ainda está desenhando neste momento */
  active: Stroke[];
}