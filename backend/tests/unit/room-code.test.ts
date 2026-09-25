import { describe, expect, it } from 'vitest';
import { generateRoomCode, ROOM_CODE_REGEX } from '../../src/utils/room-code.js';

describe('generateRoomCode', () => {
  it('gera códigos no formato XXXX-XXXX', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateRoomCode()).toMatch(ROOM_CODE_REGEX);
    }
  });

  it('nunca usa caracteres ambíguos (0, O, 1, I, L)', () => {
    const codes = Array.from({ length: 1000 }, generateRoomCode).join('');
    expect(codes).not.toMatch(/[01OIL]/);
  });

  it('não repete códigos numa amostra grande', () => {
    const codes = new Set(Array.from({ length: 5000 }, generateRoomCode));
    expect(codes.size).toBe(5000);
  });
});