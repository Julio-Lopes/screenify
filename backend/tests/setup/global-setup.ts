import { execSync } from 'node:child_process';
import { assertTestDatabase, testEnv } from './test-env.js';

/** Roda uma vez antes de todos os testes: deixa o banco de teste com o schema atual */
export default function setup(): void {
  assertTestDatabase(testEnv.DATABASE_URL);

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, ...testEnv },
  });
}