import type { ShapeTool, Stroke, StrokeTool } from '@screenify/shared';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Highlighter,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { REFERENCE_HEIGHT } from './geometry';

/** Tudo que a barra seleciona: as ferramentas que desenham, a borracha e a seleção (não desenhar) */
export type ToolId = 'select' | StrokeTool | 'eraser';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  icon: LucideIcon;
  /** Atalho de uma letra, como no design system */
  key: string;
}

export const TOOLS: readonly ToolDefinition[] = [
  { id: 'select', label: 'Selecionar', icon: MousePointer2, key: 'V' },
  { id: 'pen', label: 'Lápis', icon: Pencil, key: 'P' },
  { id: 'highlighter', label: 'Marcador', icon: Highlighter, key: 'H' },
  { id: 'line', label: 'Linha', icon: Minus, key: 'L' },
  { id: 'arrow', label: 'Seta', icon: ArrowUpRight, key: 'A' },
  { id: 'circle', label: 'Círculo', icon: Circle, key: 'O' },
  { id: 'rect', label: 'Retângulo', icon: Square, key: 'R' },
  { id: 'text', label: 'Texto', icon: Type, key: 'T' },
  { id: 'eraser', label: 'Borracha', icon: Eraser, key: 'E' },
];

/** Paleta do design system */
export const COLORS: readonly { name: string; value: string }[] = [
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Laranja', value: '#F97316' },
  { name: 'Amarelo', value: '#EAB308' },
  { name: 'Verde', value: '#22C55E' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Roxo', value: '#A855F7' },
  { name: 'Branco', value: '#FAFAFA' },
];

/** Espessuras do design system, em px numa tela de 1080 de altura */
export const WIDTHS = [2, 4, 8, 12] as const;

const SHAPE_TOOLS: readonly StrokeTool[] = ['line', 'arrow', 'rect', 'circle'] satisfies ShapeTool[];

export function isShapeTool(tool: StrokeTool): boolean {
  return SHAPE_TOOLS.includes(tool);
}

export function isFreehandTool(tool: StrokeTool): boolean {
  return tool === 'pen' || tool === 'highlighter';
}

/** O marcador é um traço largo e translúcido, para destacar sem esconder o que está embaixo */
export const HIGHLIGHTER = { widthFactor: 3, opacityFactor: 0.4 } as const;

interface Size {
  width: number;
  height: number;
}

/** Espessura exibida: proporcional à altura da imagem na tela de quem está vendo */
export function displayWidth(stroke: Pick<Stroke, 'width'>, size: Size): number {
  return Math.max(1, (stroke.width * size.height) / REFERENCE_HEIGHT);
}

/** Tamanho da fonte do texto: cresce com a espessura escolhida (2 → 18 px, 12 → 48 px em 1080p) */
export function textFontSize(stroke: Pick<Stroke, 'width'>, size: Size): number {
  return ((12 + stroke.width * 3) * size.height) / REFERENCE_HEIGHT;
}

export const TEXT_FONT_FAMILY = "'Inter Variable', Inter, system-ui, sans-serif";