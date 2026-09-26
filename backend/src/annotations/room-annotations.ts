import type { AnnotationSnapshot, Point, StartStrokePayload, Stroke } from '@screenify/shared';
import { DRAWING_LIMITS } from '../schemas/drawing.schemas.js';

/** Traços concluídos por tela anotada; acima disso os mais antigos saem */
const MAX_STROKES_PER_SURFACE = 2000;
/** Traços em andamento ao mesmo tempo por pessoa (um por dedo num touch, por exemplo) */
const MAX_ACTIVE_PER_USER = 3;

/** Formas guardam só o primeiro e o último ponto: os do meio foram só a prévia do arraste */
const SHAPE_TOOLS = new Set<Stroke['tool']>(['line', 'arrow', 'rect', 'circle']);

interface Surface {
  /** O Producer da tela que está sendo anotada */
  producerId: string;
  strokes: Map<string, Stroke>;
  active: Map<string, Stroke>;
}

/**
 * Anotações de cada sala, em memória. Pertencem à tela compartilhada do momento:
 * quando a transmissão termina ou outra começa, tudo é descartado.
 */
export class RoomAnnotations {
  private readonly surfaces = new Map<string, Surface>();

  /** Uma nova tela começou a ser transmitida: é ela que passa a receber os desenhos */
  startSurface(roomId: string, producerId: string): void {
    this.surfaces.set(roomId, { producerId, strokes: new Map(), active: new Map() });
  }

  /** Encerra a tela anotada se for esta; devolve se havia algo a limpar */
  endSurface(roomId: string, producerId: string): boolean {
    if (this.surfaces.get(roomId)?.producerId !== producerId) return false;
    this.surfaces.delete(roomId);
    return true;
  }

  deleteRoom(roomId: string): void {
    this.surfaces.delete(roomId);
  }

  /** Começa um traço; devolve o traço completo para repassar à sala, ou null se não for aceito */
  start(roomId: string, userId: string, payload: StartStrokePayload): Stroke | null {
    const surface = this.surfaces.get(roomId);
    if (!surface || surface.active.has(payload.id) || surface.strokes.has(payload.id)) return null;

    const activeOfUser = [...surface.active.values()].filter((s) => s.userId === userId).length;
    if (activeOfUser >= MAX_ACTIVE_PER_USER) return null;

    const stroke: Stroke = { ...payload, userId, points: [...payload.points] };
    surface.active.set(stroke.id, stroke);
    return stroke;
  }

  /** Acrescenta pontos a um traço em andamento; só quem começou o traço pode continuar */
  append(roomId: string, userId: string, id: string, points: Point[]): boolean {
    const stroke = this.surfaces.get(roomId)?.active.get(id);
    if (!stroke || stroke.userId !== userId) return false;
    if (stroke.points.length + points.length > DRAWING_LIMITS.pointsPerStroke) return false;

    stroke.points.push(...points);
    return true;
  }

  /** Conclui um traço em andamento */
  end(roomId: string, userId: string, id: string): boolean {
    const surface = this.surfaces.get(roomId);
    const stroke = surface?.active.get(id);
    if (!surface || !stroke || stroke.userId !== userId) return false;

    surface.active.delete(id);
    if (SHAPE_TOOLS.has(stroke.tool) && stroke.points.length > 2) {
      const first = stroke.points[0];
      const last = stroke.points.at(-1);
      if (first && last) stroke.points = [first, last];
    }
    surface.strokes.set(id, stroke);

    // Limite de memória: descarta os traços mais antigos (o Map preserva a ordem de inserção)
    while (surface.strokes.size > MAX_STROKES_PER_SURFACE) {
      const oldest = surface.strokes.keys().next().value;
      if (oldest === undefined) break;
      surface.strokes.delete(oldest);
    }
    return true;
  }

  /** Conclui tudo o que a pessoa estava desenhando (saiu da sala no meio de um traço) */
  endAllOf(roomId: string, userId: string): string[] {
    const surface = this.surfaces.get(roomId);
    if (!surface) return [];

    const ids = [...surface.active.values()].filter((s) => s.userId === userId).map((s) => s.id);
    for (const id of ids) this.end(roomId, userId, id);
    return ids;
  }

  /**
   * Remove traços concluídos (borracha, desfazer, limpar). Cada pessoa só remove os próprios;
   * quem criou a sala pode remover qualquer um. Devolve os que saíram de fato.
   */
  remove(roomId: string, userId: string, isHost: boolean, ids: string[]): string[] {
    const surface = this.surfaces.get(roomId);
    if (!surface) return [];

    const removed: string[] = [];
    for (const id of ids) {
      const stroke = surface.strokes.get(id);
      if (stroke && (isHost || stroke.userId === userId)) {
        surface.strokes.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  /** Devolve traços à tela (desfazer uma remoção, refazer um traço), com a mesma regra de permissão */
  restore(roomId: string, userId: string, isHost: boolean, strokes: Stroke[]): Stroke[] {
    const surface = this.surfaces.get(roomId);
    if (!surface) return [];

    const restored: Stroke[] = [];
    for (const stroke of strokes) {
      const allowed = isHost || stroke.userId === userId;
      const exists = surface.strokes.has(stroke.id) || surface.active.has(stroke.id);
      if (allowed && !exists && surface.strokes.size < MAX_STROKES_PER_SURFACE) {
        surface.strokes.set(stroke.id, stroke);
        restored.push(stroke);
      }
    }
    return restored;
  }

  snapshot(roomId: string): AnnotationSnapshot {
    const surface = this.surfaces.get(roomId);
    return {
      strokes: surface ? [...surface.strokes.values()] : [],
      active: surface ? [...surface.active.values()] : [],
    };
  }
}

export const roomAnnotations = new RoomAnnotations();