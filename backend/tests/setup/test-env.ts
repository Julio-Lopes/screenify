import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/** Variáveis do backend/.env.test, lidas sem mexer no process.env de quem importou */
export const testEnv = parseEnv(readFileSync(new URL('../../.env.test', import.meta.url), 'utf8')) as Record<
  string,
  string
>;

export function assertTestDatabase(url: string | undefined): void {
  if (!url?.includes('_test')) {
    throw new Error(`Os testes só rodam num banco cujo nome termina em _test. Recebido: ${url ?? '(vazio)'}`);
  }
}