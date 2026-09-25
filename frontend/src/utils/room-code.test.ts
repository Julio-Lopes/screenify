import { describe, expect, it } from 'vitest';
import { isValidRoomCode, normalizeRoomCodeInput } from './room-code';

describe('normalizeRoomCodeInput', () => {
  it.each([
    ['a7k9x2p4', 'A7K9-X2P4'],
    ['A7K9-X2P4', 'A7K9-X2P4'],
    ['  a7k9 - x2p4 ', 'A7K9-X2P4'],
    ['a7k', 'A7K'],
    ['a7k9x', 'A7K9-X'],
    ['A7K9X2P4EXTRA', 'A7K9-X2P4'],
    ['https://screenify.jcrldev.com/room/a7k9-x2p4', 'A7K9-X2P4'],
    ['http://localhost:5173/room/A7K9-X2P4?x=1', 'A7K9-X2P4'],
  ])('%s vira %s', (input, expected) => {
    expect(normalizeRoomCodeInput(input)).toBe(expected);
  });

  it('descarta caracteres fora do alfabeto (0, O, 1, I, L)', () => {
    expect(normalizeRoomCodeInput('O0I1L')).toBe('');
  });
});

describe('isValidRoomCode', () => {
  it('aceita só o formato completo', () => {
    expect(isValidRoomCode('A7K9-X2P4')).toBe(true);
    expect(isValidRoomCode('A7K9X2P4')).toBe(false);
    expect(isValidRoomCode('A7K9-X2P')).toBe(false);
    expect(isValidRoomCode('A7K9-X2P0')).toBe(false);
  });
});