/**
 * Ponto normalizado: x e y vão de 0 a 1 em relação à imagem da tela compartilhada,
 * não aos pixels de quem desenha. Assim o traço cai no mesmo lugar em 1080p, 720p ou 360p.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Ferramentas que desenham. Lápis e marcador guardam todos os pontos do traço; linha, seta,
 * retângulo e círculo guardam dois (início e fim do arraste); texto guarda um (onde começa).
 */
export type StrokeTool = FreehandTool | ShapeTool | 'text';

export type FreehandTool = 'pen' | 'highlighter';

/** Formas definidas só pelo primeiro e pelo último ponto */
export type ShapeTool = 'line' | 'arrow' | 'rect' | 'circle';

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
  /** Só na ferramenta de texto */
  text?: string;
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

export interface RemoveStrokesPayload {
  ids: string[];
}

/** Traços que voltam para a tela (desfazer uma remoção, refazer um traço) */
export interface RestoreStrokesPayload {
  strokes: Stroke[];
}