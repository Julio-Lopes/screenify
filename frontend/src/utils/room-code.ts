// Mesmo alfabeto do backend: sem 0, O, 1, I e L
const INVALID_CHARS = /[^A-HJKMNP-Z2-9]/g;
const ROOM_CODE_REGEX = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const LINK_PATTERN = /\/room\/([A-Za-z0-9-]+)/;

/**
 * Converte o que a pessoa digitou ou colou no formato XXXX-XXXX.
 * Aceita o código com ou sem hífen, em minúsculas, ou o link completo da sala.
 */
export function normalizeRoomCodeInput(raw: string): string {
  const source = raw.match(LINK_PATTERN)?.[1] ?? raw;
  const chars = source.toUpperCase().replace(INVALID_CHARS, '').slice(0, 8);

  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}

export function buildRoomUrl(code: string): string {
  return `${window.location.origin}/room/${code}`;
}