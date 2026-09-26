import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSocket } from '../services/socket';
import { FLUSH_INTERVAL_MS, StrokeSender } from './stroke-sender';

function fakeSocket() {
  const emit = vi.fn();
  return { socket: { emit } as unknown as AppSocket, emit };
}

const stroke = {
  id: 'a',
  userId: 'u1',
  tool: 'pen' as const,
  color: '#34D399',
  width: 4,
  opacity: 1,
  points: [{ x: 0.1, y: 0.1 }],
};

describe('StrokeSender', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('envia o começo sem o userId: quem define o autor é o servidor', () => {
    const { socket, emit } = fakeSocket();
    new StrokeSender(socket).start(stroke);

    const { userId: _userId, ...expected } = stroke;
    expect(emit).toHaveBeenCalledWith('drawing:start', expected);
  });

  it('junta os pontos de vários movimentos numa mensagem só', () => {
    const { socket, emit } = fakeSocket();
    const sender = new StrokeSender(socket);

    for (let i = 0; i < 30; i++) sender.add('a', [{ x: i / 100, y: 0.5 }]);
    expect(emit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(FLUSH_INTERVAL_MS);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]?.[1].points).toHaveLength(30);
  });

  it('em formas, manda só a posição mais recente do arraste', () => {
    const { socket, emit } = fakeSocket();
    const sender = new StrokeSender(socket);

    for (let i = 0; i < 10; i++) sender.add('a', [{ x: i / 10, y: 0.5 }], 'latest');
    vi.advanceTimersByTime(FLUSH_INTERVAL_MS);

    expect(emit.mock.calls[0]?.[1].points).toEqual([{ x: 0.9, y: 0.5 }]);
  });

  it('envia o que falta antes de concluir o traço', () => {
    const { socket, emit } = fakeSocket();
    const sender = new StrokeSender(socket);

    sender.add('a', [{ x: 0.2, y: 0.2 }]);
    sender.end('a');

    expect(emit.mock.calls.map((call) => call[0])).toEqual(['drawing:append', 'drawing:end']);
  });
});