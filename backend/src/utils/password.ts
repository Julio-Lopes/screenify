import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
// scrypt usa 128 * N * r bytes de memória (32 MB aqui); o padrão do Node é 32 MB, então damos folga
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

// Formato salvo: scrypt$N$r$p$salt$hash (salt e hash em base64)
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, { ...PARAMS, maxmem: MAX_MEMORY });

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltB64, hashB64] = stored.split('$');

  if (algorithm !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) {
    return false;
  }

  const expected = Buffer.from(hashB64, 'base64');
  const key = await deriveKey(password, Buffer.from(saltB64, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEMORY,
  });

  return key.length === expected.length && timingSafeEqual(key, expected);
}