import { randomInt } from 'node:crypto';

// Sem 0, O, 1, I e L para evitar confusão ao digitar ou ditar o código
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUP_LENGTH = 4;

export const ROOM_CODE_REGEX = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

function randomGroup(): string {
  let group = '';
  for (let i = 0; i < GROUP_LENGTH; i++) {
    group += ALPHABET[randomInt(ALPHABET.length)];
  }
  return group;
}

export function generateRoomCode(): string {
  return `${randomGroup()}-${randomGroup()}`;
}