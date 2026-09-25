import { prisma } from '../../src/database/prisma.js';
import { assertTestDatabase } from '../setup/test-env.js';

export async function resetDatabase(): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL);
  await prisma.$executeRaw`TRUNCATE TABLE room_participants, rooms, users CASCADE`;
}

/** Repete a verificação até passar ou estourar o tempo (para efeitos assíncronos no servidor) */
export async function eventually(assertion: () => Promise<void>, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}