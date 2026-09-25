import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/password.js';

describe('hashPassword / verifyPassword', () => {
  it('aceita a senha certa e recusa a errada', async () => {
    const hash = await hashPassword('minha senha');

    await expect(verifyPassword('minha senha', hash)).resolves.toBe(true);
    await expect(verifyPassword('minha senhA', hash)).resolves.toBe(false);
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const [a, b] = await Promise.all([hashPassword('segredo'), hashPassword('segredo')]);
    expect(a).not.toBe(b);
  });

  it('não guarda a senha em texto puro', async () => {
    const hash = await hashPassword('segredo');
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(hash).not.toContain('segredo');
  });

  it('trata acentos digitados de formas diferentes como iguais', async () => {
    const composed = 'caf\u00e9'; // "é" como um caractere só
    const decomposed = 'cafe\u0301'; // "e" + acento combinante
    const hash = await hashPassword(composed);

    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });

  it('recusa hash em formato inválido sem lançar erro', async () => {
    await expect(verifyPassword('qualquer', 'nao-e-um-hash')).resolves.toBe(false);
  });
});