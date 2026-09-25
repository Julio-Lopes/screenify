import type { GuestSessionResponse, PublicUser } from '@screenify/shared';
import { prisma } from '../database/prisma.js';
import type { CreateGuestInput } from '../schemas/user.schemas.js';
import { generateSessionToken, hashSessionToken } from '../utils/session-token.js';

export type AuthUser = PublicUser;

export async function createGuest(input: CreateGuestInput): Promise<GuestSessionResponse> {
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