import { afterAll } from 'vitest';
import { prisma } from '../../src/database/prisma.js';

// Cada arquivo de teste tem seu próprio client; fechar o pool evita conexões penduradas
afterAll(async () => {
  await prisma.$disconnect();
});