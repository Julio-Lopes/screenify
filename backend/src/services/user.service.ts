import { prisma } from '../database/prisma.js';
import type { CreateGuestInput } from '../schemas/user.schemas.js';
import { generateSessionToken, hashSessionToken } from '../utils/session-token.js';

export interface AuthUser {
  id: string;
  displayName: string;
}

export async function createGuest(
  input: CreateGuestInput,
): Promise<{ user: AuthUser; token: string }> {
  const token = generateSessionToken();

  const user = await prisma.user.create({
    data: {
      displayName: input.displayName,
      sessionTokenHash: hashSessionToken(token),
    },
    select: { id: true, displayName: true },
  });

  return { user, token };
}

export async function findUserBySessionToken(token: string): Promise<AuthUser | null> {
  return prisma.user.findUnique({
    where: { sessionTokenHash: hashSessionToken(token) },
    select: { id: true, displayName: true },
  });
}