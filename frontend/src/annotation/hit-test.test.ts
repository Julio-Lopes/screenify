import type { Stroke } from '@screenify/shared';
import { describe, expect, it } from 'vitest';
import { distanceToSegment, hitStroke } from './hit-test';

const size = { width: 1920, height: 1080 };

function stroke(tool: Stroke['tool'], points: [number, number][], extra: Partial<Stroke> = {}): Stroke {
  return {
    id: 'x',
    userId: 'u',
    tool,
    color: '#EF4444',
    width: 4,
    opacity: 1,
    points: points.map(([x, y]) => ({ x, y })),
    ...extra,
  };
}

describe('distanceToSegment', () => {
  it('mede a distância perpendicular e até as pontas', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(distanceToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
});

describe('hitStroke', () => {
  it('acerta a linha perto do traço e erra longe dele', () => {
    const line = stroke('line', [[0.1, 0.5], [0.9, 0.5]]);
    expect(hitStroke(line, { x: 0.5, y: 0.505 }, size, 8)).toBe(true);
    expect(hitStroke(line, { x: 0.5, y: 0.6 }, size, 8)).toBe(false);
  });

  it('no retângulo, só o contorno conta: o meio fica livre', () => {
    const rect = stroke('rect', [[0.2, 0.2], [0.8, 0.8]]);
    expect(hitStroke(rect, { x: 0.2, y: 0.5 }, size, 8)).toBe(true);
    expect(hitStroke(rect, { x: 0.5, y: 0.5 }, size, 8)).toBe(false);
  });

  it('no círculo, também só o contorno', () => {
    const circle = stroke('circle', [[0.4, 0.4], [0.6, 0.6]]);
    expect(hitStroke(circle, { x: 0.6, y: 0.5 }, size, 8)).toBe(true);
    expect(hitStroke(circle, { x: 0.5, y: 0.5 }, size, 8)).toBe(false);
  });

  it('no texto, a área ocupada pelas letras', () => {
    const text = stroke('text', [[0.1, 0.1]], { text: 'Olha aqui' });
    expect(hitStroke(text, { x: 0.12, y: 0.11 }, size, 4)).toBe(true);
    expect(hitStroke(text, { x: 0.5, y: 0.5 }, size, 4)).toBe(false);
  });

  it('traços mais grossos são mais fáceis de acertar', () => {
    const thin = stroke('pen', [[0.1, 0.5], [0.9, 0.5]], { width: 2 });
    const thick = stroke('pen', [[0.1, 0.5], [0.9, 0.5]], { width: 12 });
    const point = { x: 0.5, y: 0.5 + 12 / 1080 };
    expect(hitStroke(thin, point, size, 6)).toBe(false);
    expect(hitStroke(thick, point, size, 6)).toBe(true);
  });
});